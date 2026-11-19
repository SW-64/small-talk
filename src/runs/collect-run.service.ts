import { ConflictException, Inject, Injectable, Logger } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { DataSource, EntityManager, In } from 'typeorm';
import { trendIssuesConfig } from '../config/trend-issues.config';
import { Article } from '../database/entities/article.entity';
import { DailyRun } from '../database/entities/daily-run.entity';
import { IssueArticle } from '../database/entities/issue-article.entity';
import { Issue } from '../database/entities/issue.entity';
import { TrendIssuesService } from '../news/trend-issues/trend-issues.service';
import {
  computeKstWindow,
  toKstIso,
} from '../news/trend-issues/utils/kst-window';
import { ArticleRow, buildRunRows, IssueRow } from './build-run-rows';

const CHUNK = 500;

export interface CollectRunOptions {
  date?: string; // 기준 당일(KST). 생략하면 가장 최근에 끝난 06:00 기준
  force?: boolean; // 같은 날짜 실행분이 있으면 지우고 다시 만든다
}

export interface CollectRunResult {
  runDate: string;
  window: { start: string; end: string };
  replaced: boolean;
  issues: number;
  cardIssues: number; // categoryRank 가 있는 이슈
  rankedIssues: number; // overallRank 가 있는 이슈
  articles: number; // 이번 실행에 연결된 기사 수 (기존 행 재사용 포함)
  datalabCalls: { used: number; limit: number };
}

/**
 * ② 일일 수집: 뉴스 수집 → 이슈 묶기 → 데이터랩 랭킹 → DB 저장(트랜잭션 하나).
 * 저장 후 daily_runs.status 는 collecting (③ 사실 추출에서 다음 단계로 넘긴다)
 */
@Injectable()
export class CollectRunService {
  private readonly logger = new Logger(CollectRunService.name);

  constructor(
    private readonly trendIssues: TrendIssuesService,
    private readonly dataSource: DataSource,
    @Inject(trendIssuesConfig.KEY)
    private readonly config: ConfigType<typeof trendIssuesConfig>,
  ) {}

  async collect(
    { date, force = false }: CollectRunOptions = {},
    now = new Date(),
  ): Promise<CollectRunResult> {
    const window = computeKstWindow(now, this.config.window.startHourKst, date);
    const runDate = toKstIso(window.end).slice(0, 10);

    // 수집(수 분 소요) 전에 먼저 막는다
    const existing = await this.dataSource
      .getRepository(DailyRun)
      .existsBy({ runDate });
    if (existing && !force) {
      throw new ConflictException(
        `${runDate} 실행분이 이미 있습니다. 다시 만들려면 force: true`,
      );
    }

    const { ranking, candidates } = await this.trendIssues.collectAndRank(
      { date },
      now,
    );
    const rows = buildRunRows(ranking, candidates);

    const saved = await this.dataSource.transaction(async (em) => {
      // 이슈·사실·카드는 daily_runs 삭제에 CASCADE 로 함께 지워진다. 기사는 남긴다
      const deleted = await em.delete(DailyRun, { runDate });
      await em.insert(DailyRun, {
        runDate,
        status: 'collecting',
        windowStart: window.start,
        windowEnd: window.end,
        publishedAt: null,
      });
      const articleIds = await this.upsertArticles(em, rows.articles);
      await this.insertIssues(em, runDate, rows.issues, articleIds);
      return {
        replaced: (deleted.affected ?? 0) > 0,
        articles: articleIds.size,
      };
    });

    const result: CollectRunResult = {
      runDate,
      window: { start: toKstIso(window.start), end: toKstIso(window.end) },
      replaced: saved.replaced,
      issues: rows.issues.length,
      cardIssues: rows.issues.filter((i) => i.categoryRank !== null).length,
      rankedIssues: rows.issues.filter((i) => i.overallRank !== null).length,
      articles: saved.articles,
      datalabCalls: { used: ranking.calls.used, limit: ranking.calls.limit },
    };
    this.logger.log(
      `[저장] ${runDate} — 이슈 ${result.issues}개(카드 ${result.cardIssues}, 랭킹 ${result.rankedIssues}), 기사 ${result.articles}건${result.replaced ? ' (기존 실행분 교체)' : ''}`,
    );
    return result;
  }

  // 같은 URL 기사는 기존 행을 재사용한다 (먼저 저장된 발췌문 유지). url → id
  private async upsertArticles(
    em: EntityManager,
    articles: ArticleRow[],
  ): Promise<Map<string, string>> {
    for (let i = 0; i < articles.length; i += CHUNK) {
      await em
        .createQueryBuilder()
        .insert()
        .into(Article)
        .values(articles.slice(i, i + CHUNK))
        .orIgnore()
        .execute();
    }

    const ids = new Map<string, string>();
    const urls = articles.map((a) => a.url);
    for (let i = 0; i < urls.length; i += CHUNK) {
      const found = await em.find(Article, {
        select: { id: true, url: true },
        where: { url: In(urls.slice(i, i + CHUNK)) },
      });
      for (const { id, url } of found) ids.set(url, id);
    }
    return ids;
  }

  private async insertIssues(
    em: EntityManager,
    runDate: string,
    issues: IssueRow[],
    articleIds: Map<string, string>,
  ): Promise<void> {
    const links: { issueId: string; articleId: string }[] = [];

    for (const issue of issues) {
      const { identifiers } = await em.insert(Issue, {
        runDate,
        category: issue.category,
        representativeTitle: issue.representativeTitle,
        searchTerms: issue.searchTerms,
        searchScore: issue.searchScore,
        categoryRank: issue.categoryRank,
        overallRank: issue.overallRank,
      });
      const issueId = String(identifiers[0].id);
      for (const url of issue.articleUrls) {
        const articleId = articleIds.get(url);
        if (!articleId) throw new Error(`기사 id 를 찾지 못했습니다: ${url}`);
        links.push({ issueId, articleId });
      }
    }

    for (let i = 0; i < links.length; i += CHUNK) {
      await em.insert(IssueArticle, links.slice(i, i + CHUNK));
    }
  }
}
