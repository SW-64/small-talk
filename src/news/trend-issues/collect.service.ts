import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { trendIssuesConfig } from '../../config/trend-issues.config';
import {
  NaverBudgetExceededError,
  NaverNewsClient,
} from '../naver/naver-news.client';
import { CallBudget } from '../common/call-budget';
import {
  KeywordCollectResult,
  KeywordTarget,
  RawArticle,
  TimeWindow,
} from './trend-issues.types';
import { mapWithConcurrency } from './utils/concurrency';
import { parsePubDate } from './utils/pub-date';

/**
 * [1] 수집: 키워드마다 sort=date 로 페이지를 넘기며 수집 기간 안의 기사만 모은다.
 * API 응답 필드만 사용하고 기사 본문은 가져오지 않는다.
 */
@Injectable()
export class CollectService {
  private readonly logger = new Logger(CollectService.name);

  constructor(
    private readonly naver: NaverNewsClient,
    @Inject(trendIssuesConfig.KEY)
    private readonly config: ConfigType<typeof trendIssuesConfig>,
  ) {}

  async collectAll(
    targets: KeywordTarget[],
    window: TimeWindow,
    budget: CallBudget,
  ): Promise<KeywordCollectResult[]> {
    const results = await mapWithConcurrency(
      targets,
      this.config.fetch.concurrency,
      (target) => this.collectKeyword(target, window, budget),
    );

    const stopped = results.filter((r) => r.budgetStopped);
    const skipped = results.filter((r) => r.skipped);
    if (stopped.length > 0 || skipped.length > 0) {
      const names = (list: KeywordCollectResult[]) =>
        list.map((r) => r.keyword).join(', ') || '없음';
      this.logger.warn(
        `[수집] 호출 예산 ${budget.limit}회 소진 — 중단: ${names(stopped)} / 건너뜀: ${names(skipped)}`,
      );
    }
    return results;
  }

  async collectKeyword(
    target: KeywordTarget,
    window: TimeWindow,
    budget: CallBudget,
  ): Promise<KeywordCollectResult> {
    const { category, keyword } = target;
    const { display, maxStart, maxRetries, retryBaseMs, timeoutMs } =
      this.config.fetch;
    const startMs = window.start.getTime();
    const endMs = window.end.getTime();

    const articles: RawArticle[] = [];
    let pages = 0;
    let calls = 0;
    let invalidDates = 0;
    let limitReached = false;
    let budgetExceeded = false;

    const acquire = () => {
      if (!budget.tryAcquire()) return false;
      calls++;
      return true;
    };

    for (let start = 1; start <= maxStart; start += display) {
      let items;
      try {
        ({ items } = await this.naver.search(
          { query: keyword, display, start, sort: 'date' },
          { maxRetries, retryBaseMs, timeoutMs, acquire },
        ));
      } catch (error) {
        if (error instanceof NaverBudgetExceededError) {
          budgetExceeded = true;
          break;
        }
        this.logger.error(
          `[수집] ${keyword}: start=${start} 호출 실패 — 키워드 건너뜀 (${String(error)})`,
        );
        return {
          ...target,
          pages,
          calls,
          articles: [],
          failed: true,
          limitReached,
          skipped: false,
          budgetStopped: false,
        };
      }
      pages++;

      let reachedOlder = false;
      for (const item of items) {
        const publishedAt = parsePubDate(item.pubDate);
        if (!publishedAt) {
          invalidDates++;
          continue;
        }
        const time = publishedAt.getTime();
        if (time >= endMs) continue; // 범위보다 새로운 기사
        if (time < startMs) {
          reachedOlder = true; // sort=date 이므로 이후는 모두 범위 밖
          break;
        }
        articles.push({ item, category, keyword, publishedAt });
      }

      if (reachedOlder || items.length < display) break;
      if (start + display > maxStart) {
        limitReached = true;
        this.logger.warn(
          `[수집] ${keyword}: start ${maxStart} 한도 도달, 아직 수집 범위 안 — 키워드를 좁혀야 함`,
        );
      }
    }

    if (invalidDates > 0) {
      this.logger.warn(
        `[수집] ${keyword}: pubDate 파싱 실패 ${invalidDates}건 제외`,
      );
    }
    this.logger.log(
      `[수집] ${category}/${keyword}: 호출 ${calls}회, ${pages}페이지, 범위 내 ${articles.length}건`,
    );
    return {
      ...target,
      pages,
      calls,
      articles,
      failed: false,
      limitReached,
      skipped: budgetExceeded && calls === 0,
      budgetStopped: budgetExceeded && calls > 0,
    };
  }
}
