import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { trendIssuesConfig } from '../../config/trend-issues.config';
import { CallBudget } from '../common/call-budget';
import { RankingService } from '../ranking/ranking.service';
import { RankingIssueInput } from '../ranking/ranking.types';
import { clusterTitles } from './clustering/cluster';
import { CollectService } from './collect.service';
import { computeContributions } from './contribution';
import { countPublishers, normalizeArticles } from './normalize';
import { buildIssueClusters, selectTopIssues } from './rank';
import { formatSummary } from './summary';
import {
  CategoryResult,
  CollectAndRankResult,
  IssueCluster,
  KeywordStats,
  KeywordTarget,
  TimeWindow,
  TrendIssue,
  TrendIssuesResult,
  TrendIssuesRunOptions,
  WindowType,
} from './trend-issues.types';
import {
  computeKstWindow,
  computeLast24hWindow,
  toKstIso,
} from './utils/kst-window';

/**
 * 트렌드 이슈 추출 파이프라인: 수집 → 정리 → 묶기 → 세기 → 선택 (→ 선택적으로 랭킹)
 * 실험용 — DB 저장 없이 메모리에서만 처리
 */
@Injectable()
export class TrendIssuesService {
  private readonly logger = new Logger(TrendIssuesService.name);

  constructor(
    private readonly collector: CollectService,
    @Inject(trendIssuesConfig.KEY)
    private readonly config: ConfigType<typeof trendIssuesConfig>,
    private readonly ranking: RankingService,
  ) {}

  async run(
    options: TrendIssuesRunOptions = {},
    now = new Date(),
  ): Promise<TrendIssuesResult> {
    return (await this.execute(options, now)).result;
  }

  /**
   * 일일 수집용: 전날 06시 ~ 당일 06시 수집 → 데이터랩 랭킹까지 실행하고,
   * DB 저장에 필요한 랭킹 후보 묶음(랭킹 id → 묶음)을 함께 돌려준다
   */
  async collectAndRank(
    options: Pick<TrendIssuesRunOptions, 'date'> = {},
    now = new Date(),
  ): Promise<CollectAndRankResult> {
    const { result, window, candidates } = await this.execute(
      { date: options.date, window: 'previousDay', ranking: 'datalab' },
      now,
    );
    if (!result.ranking) throw new Error('랭킹 결과가 없습니다');
    return { window, ranking: result.ranking, candidates };
  }

  private async execute(
    options: TrendIssuesRunOptions,
    now: Date,
  ): Promise<{
    result: TrendIssuesResult;
    window: TimeWindow;
    candidates: Map<string, IssueCluster>;
  }> {
    const windowType = options.window ?? 'previousDay';
    const window = this.resolveWindow(windowType, options.date, now);
    const categories = this.resolveCategories(options.categories);
    const categoryOrder = categories.map((c) => c.id);
    const targets: KeywordTarget[] = categories.flatMap(({ id, keywords }) =>
      keywords.slice(0, options.maxKeywordsPerCategory).map((k) => ({
        category: id,
        keyword: k.text,
        seasonal: k.seasonal,
      })),
    );

    const windowIso = {
      type: windowType,
      start: toKstIso(window.start),
      end: toKstIso(window.end),
    };

    // [1] 수집
    this.logger.log(
      `[수집] 시작 — 카테고리 ${categoryOrder.join(', ')} / 키워드 ${targets.length}개 / ${windowIso.start} ~ ${windowIso.end}`,
    );
    const budget = new CallBudget(this.config.fetch.maxCallsPerRun);
    const collected = await this.collector.collectAll(targets, window, budget);
    const raws = collected.flatMap((r) => r.articles);
    this.logger.log(
      `[수집] 완료 — 호출 ${budget.used}/${budget.limit}회, 총 ${raws.length}건`,
    );

    // [2] 정리
    const { articles, duplicates } = normalizeArticles(raws, {
      trackingParams: this.config.trackingParams,
      trackingParamPrefixes: this.config.trackingParamPrefixes,
      domainPrefixes: this.config.domainPrefixes,
      naverOidToDomain: new Map(
        this.config.majorPublishers.map((p) => [p.naverOid, p.domain]),
      ),
    });
    this.logger.log(
      `[정리] 수집 ${raws.length}건 → 중복 제거 후 ${articles.length}건 (중복 ${duplicates}건)`,
    );

    // [3] 묶기
    const clusteringStartedAt = Date.now();
    const groups = clusterTitles(
      articles.map((a) => a.title),
      this.config.clustering,
    );
    const clusteringMs = Date.now() - clusteringStartedAt;
    const multiArticleClusters = groups.filter((g) => g.length >= 2).length;
    const largestCluster = groups.reduce((m, g) => Math.max(m, g.length), 0);
    this.logger.log(
      `[묶기] ${articles.length}건 → 묶음 ${groups.length}개 (2건 이상 묶음 ${multiArticleClusters}개, 최대 묶음 ${largestCluster}건, 기준 유사도 ${this.config.clustering.similarityThreshold}, ${clusteringMs}ms)`,
    );

    // [4] 세기
    const clusters = buildIssueClusters(articles, groups, {
      categoryOrder,
      majorDomains: new Set(this.config.majorPublishers.map((p) => p.domain)),
      excludeWords: this.config.excludeWords,
      marketReportWords: this.config.marketReportWords,
    });

    // [5] 선택
    const selections = categoryOrder.map((category) => {
      const own = clusters.filter((c) => c.category === category);
      const { qualified, top } = selectTopIssues(own, this.config.selection);
      const ownArticles = own.flatMap((c) => c.articles);
      const result: CategoryResult = {
        category,
        articles: ownArticles.length,
        publishers: countPublishers(ownArticles),
        clusters: own.length,
        qualified: qualified.length,
        issues: top.map(toTrendIssue),
      };
      this.logger.log(
        `[선택] ${category}: 묶음 ${own.length}개 → 주요 언론사 ${this.config.selection.minMajorPublishers}곳 이상 ${qualified.length}개 → 상위 ${top.length}개`,
      );
      return { result, top, qualified };
    });

    const contributions = computeContributions(
      selections.flatMap((s) => s.top),
    );
    const perKeyword: KeywordStats[] = collected.map((r) => ({
      category: r.category,
      keyword: r.keyword,
      seasonal: r.seasonal,
      calls: r.calls,
      pages: r.pages,
      articlesInWindow: r.articles.length,
      limitReached: r.limitReached,
      failed: r.failed,
      skipped: r.skipped,
      budgetStopped: r.budgetStopped,
      topIssues: contributions.get(r.keyword)?.topIssues ?? 0,
      soloTopIssues: contributions.get(r.keyword)?.soloTopIssues ?? 0,
    }));

    const result: TrendIssuesResult = {
      window: windowIso,
      stats: {
        calls: {
          used: budget.used,
          limit: budget.limit,
          exhausted: budget.exhausted,
        },
        articles: {
          beforeDedup: raws.length,
          afterDedup: articles.length,
          duplicates,
        },
        publishers: countPublishers(articles),
        clusters: groups.length,
        multiArticleClusters,
        largestCluster,
        clusteringMs,
        failedKeywords: collected.filter((r) => r.failed).map((r) => r.keyword),
        skippedKeywords: collected
          .filter((r) => r.skipped)
          .map((r) => r.keyword),
        perKeyword,
      },
      categories: selections.map((s) => s.result),
    };

    for (const line of formatSummary(result)) this.logger.log(line);

    // [6] 랭킹 (선택)
    const candidates = new Map<string, IssueCluster>();
    if (options.ranking === 'datalab') {
      const { inputs, clusters, droppedByFlags } = this.buildRankingInputs(
        selections.map((s) => s.qualified),
      );
      this.logger.log(
        `[랭킹] 후보 ${inputs.length}개 (제외·시황 플래그로 빠진 묶음 ${droppedByFlags}개)`,
      );
      const ranking = await this.ranking.rank(inputs, {
        referenceTime: window.end,
      });
      result.ranking = { ...ranking, droppedByFlags };
      inputs.forEach((input, i) => candidates.set(input.id, clusters[i]));
    }

    return { result, window, candidates };
  }

  // 플래그 없는 묶음을 카테고리별 언론사 수 순으로 최대 N개 (qualified 는 이미 정렬됨)
  private buildRankingInputs(qualifiedByCategory: IssueCluster[][]) {
    const limit = this.config.selection.rankingCandidatesPerCategory;
    let droppedByFlags = 0;

    const clusters = qualifiedByCategory.flatMap((qualified) => {
      const clean = qualified.filter((c) => !c.excluded && !c.marketReport);
      droppedByFlags += qualified.length - clean.length;
      return clean.slice(0, limit);
    });
    const perCategory = new Map<string, number>();
    const inputs = clusters.map((cluster): RankingIssueInput => {
      const index = (perCategory.get(cluster.category) ?? 0) + 1;
      perCategory.set(cluster.category, index);
      return {
        id: `${cluster.category}-${index}`,
        category: cluster.category,
        representativeTitle: cluster.representativeTitle,
        publisherCount: cluster.publisherCount,
        titles: cluster.articles.map((a) => a.title),
      };
    });
    return { inputs, clusters, droppedByFlags };
  }

  private resolveWindow(
    type: WindowType,
    date: string | undefined,
    now: Date,
  ): TimeWindow {
    if (type === 'last24h') {
      if (date) {
        throw new BadRequestException(
          'date 는 window=last24h 와 함께 쓸 수 없습니다',
        );
      }
      return computeLast24hWindow(now);
    }
    return computeKstWindow(now, this.config.window.startHourKst, date);
  }

  // 설정 순서를 유지해 요청 순서와 무관하게 동점 우선순위가 같도록 한다
  private resolveCategories(requested?: string[]) {
    const { categories } = this.config;
    if (!requested) return categories;

    const known = categories.map((c) => c.id);
    const unknown = requested.filter((id) => !known.includes(id));
    if (unknown.length > 0) {
      throw new BadRequestException(
        `알 수 없는 카테고리: ${unknown.join(', ')} (사용 가능: ${known.join(', ')})`,
      );
    }
    return categories.filter((c) => requested.includes(c.id));
  }
}

function toTrendIssue(cluster: IssueCluster, index: number): TrendIssue {
  return {
    rank: index + 1,
    representativeTitle: cluster.representativeTitle,
    publisherCount: cluster.publisherCount,
    majorPublisherCount: cluster.majorPublisherCount,
    articleCount: cluster.articleCount,
    keywords: cluster.keywords,
    publishers: cluster.publishers,
    majorPublishers: cluster.majorPublishers,
    excluded: cluster.excluded,
    excludeReasons: cluster.excludeReasons,
    marketReport: cluster.marketReport,
    marketReportWords: cluster.marketReportWords,
    articles: cluster.articles.map((a) => ({
      title: a.title,
      description: a.description,
      url: a.url,
      publisher: a.publisher,
      publishedAt: toKstIso(a.publishedAt),
      sources: a.sources,
    })),
  };
}
