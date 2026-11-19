import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { trendIssuesConfig } from '../config/trend-issues.config';
import { IssueCardsService } from './issue-cards/issue-cards.service';
import { IssueCard } from './issue-cards/issue-cards.types';
import { PromptArticle } from './issue-cards/issue-card.prompt';
import { NaverNewsClient } from './naver/naver-news.client';
import { resolvePublisher } from './trend-issues/utils/domain';
import { stripHtml } from './trend-issues/utils/html';
import { toKstIso } from './trend-issues/utils/kst-window';
import { parsePubDate } from './trend-issues/utils/pub-date';

// 카테고리 id → 샘플 검색어. 없는 카테고리는 id 를 그대로 검색한다
const SAMPLE_QUERIES: Record<string, string> = {
  economy: '경제',
  tech: '테크',
  culture: '문화',
  society: '사회',
  environment: '환경',
};

export interface SampleCategoryResult {
  category: string;
  query: string;
  article: PromptArticle | null;
  card: IssueCard | null;
  error?: string; // 기사 수집 실패 또는 검색 결과 없음
}

export interface SampleCardsResult {
  model: string;
  calls: { gemini: { used: number; limit: number; exhausted: boolean } };
  categories: SampleCategoryResult[];
}

/**
 * 개발용 샘플: 카테고리별 최신 기사 1건씩 수집해 Gemini 한 번의 요청으로 카드(3줄 요약 + 스몰토크)를 만든다.
 * trend-issues 파이프라인(묶기·선택)을 거치지 않는 가벼운 확인용
 */
@Injectable()
export class NewsService {
  private readonly logger = new Logger(NewsService.name);

  constructor(
    private readonly naver: NaverNewsClient,
    private readonly issueCards: IssueCardsService,
    @Inject(trendIssuesConfig.KEY)
    private readonly trendConfig: ConfigType<typeof trendIssuesConfig>,
  ) {}

  async sampleCards(): Promise<SampleCardsResult> {
    const fetched = await Promise.all(
      this.trendConfig.categories.map(async ({ id }) => {
        const query = SAMPLE_QUERIES[id] ?? id;
        try {
          const article = await this.fetchLatest(query);
          return article
            ? { category: id, query, article }
            : { category: id, query, article: null, error: '검색 결과 없음' };
        } catch (error) {
          this.logger.error(`[샘플] ${id} 기사 수집 실패: ${String(error)}`);
          return {
            category: id,
            query,
            article: null,
            error: 'NAVER API 요청에 실패했습니다',
          };
        }
      }),
    );

    const budget = this.issueCards.createBudget();
    const withArticle = fetched.filter((entry) => entry.article !== null);
    const cards = await this.issueCards.generateCards(
      withArticle.map(({ category, article }) => ({
        category,
        issue: {
          rank: 1,
          representativeTitle: article.title,
          publisherCount: 1,
          articleCount: 1,
          articles: [article],
        },
      })),
      budget,
    );
    const cardByCategory = new Map(
      withArticle.map((entry, i) => [entry.category, cards[i]]),
    );
    const categories: SampleCategoryResult[] = fetched.map((entry) => ({
      ...entry,
      card: cardByCategory.get(entry.category) ?? null,
    }));

    return {
      model: this.issueCards.model,
      calls: {
        gemini: {
          used: budget.used,
          limit: budget.limit,
          exhausted: budget.exhausted,
        },
      },
      categories,
    };
  }

  private async fetchLatest(query: string): Promise<PromptArticle | null> {
    const { fetch, domainPrefixes, majorPublishers } = this.trendConfig;
    const body = await this.naver.search(
      { query, display: 1, start: 1, sort: 'date' },
      {
        maxRetries: fetch.maxRetries,
        retryBaseMs: fetch.retryBaseMs,
        timeoutMs: fetch.timeoutMs,
      },
    );
    const item = body.items[0];
    if (!item) return null;

    const url = item.originallink || item.link;
    const publishedAt = parsePubDate(item.pubDate);
    return {
      title: stripHtml(item.title),
      description: stripHtml(item.description),
      url,
      publisher: resolvePublisher(url, item.link, {
        domainPrefixes,
        naverOidToDomain: new Map(
          majorPublishers.map((p) => [p.naverOid, p.domain]),
        ),
      }),
      publishedAt: publishedAt ? toKstIso(publishedAt) : item.pubDate,
      sources: [],
    };
  }
}
