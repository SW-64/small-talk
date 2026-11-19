import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { rankingConfig } from '../../config/ranking.config';
import { CallBudget } from '../common/call-budget';
import { assignRanks } from './assign-ranks';
import { DatalabClient, DatalabGroupResult } from './datalab.client';
import { computeDatalabPeriod } from './datalab-period';
import { formatRankingSummary } from './ranking-summary';
import {
  DatalabCallStats,
  DatalabTestResult,
  RankingFailureReason,
  RankingIssueInput,
  RankingResult,
  ScoreFields,
} from './ranking.types';
import { SearchTermService } from './search-term.service';

/**
 * 이슈 목록을 입력받아 데이터랩 어제 검색량(공통 기준 키워드 대비 비율)으로 점수를 매기고 순위를 정한다.
 * 수집 파이프라인과 독립적으로 실행할 수 있다.
 */
@Injectable()
export class RankingService {
  private readonly logger = new Logger(RankingService.name);

  constructor(
    private readonly datalab: DatalabClient,
    private readonly searchTerms: SearchTermService,
    @Inject(rankingConfig.KEY)
    private readonly config: ConfigType<typeof rankingConfig>,
  ) {}

  // referenceTime 의 KST 날짜 기준 "어제" 하루를 조회한다
  async rank(
    issues: RankingIssueInput[],
    { referenceTime }: { referenceTime: Date },
  ): Promise<RankingResult> {
    const { ages, anchorKeyword, cardsPerCategory, overallTopN } = this.config;
    const period = computeDatalabPeriod(referenceTime, 1);
    const budget = this.createBudget();

    const withTerms = issues.map((issue) => ({
      issue,
      terms: this.searchTerms.extract(issue.titles),
    }));
    const trends = await this.datalab.fetchTrends(
      withTerms
        .filter(({ terms }) => terms.length > 0)
        .map(({ issue, terms }) => ({
          groupName: issue.id,
          keywords: terms.map((t) => t.term),
        })),
      { period, ages, anchor: anchorKeyword },
      budget,
    );
    const trendById = new Map(trends.map((t) => [t.groupName, t]));

    const scored = withTerms.map(({ issue, terms }) => ({
      id: issue.id,
      category: issue.category,
      representativeTitle: issue.representativeTitle,
      publisherCount: issue.publisherCount,
      searchTerms: terms,
      ...toScoreFields(terms.length > 0, trendById.get(issue.id)),
    }));
    const ranked = assignRanks(scored, { cardsPerCategory, overallTopN });

    const failed = ranked.filter((issue) => issue.score === null).length;
    const result: RankingResult = {
      date: period.endDate,
      ages,
      anchorKeyword,
      calls: toCallStats(budget),
      candidates: {
        total: ranked.length,
        ranked: ranked.length - failed,
        failed,
      },
      issues: ranked,
    };

    for (const line of formatRankingSummary(result, this.config)) {
      this.logger.log(line);
    }
    return result;
  }

  // 개발용: 검색어를 그대로 조회해 기준 키워드 대비 어제 점수를 돌려준다. 기준 키워드 후보 비교에도 쓴다
  async testTerms(
    terms: string[],
    options: { ages?: string[]; anchor?: string } = {},
    referenceTime = new Date(),
  ): Promise<DatalabTestResult> {
    const ages = options.ages ?? this.config.ages;
    const anchorKeyword = options.anchor ?? this.config.anchorKeyword;
    const period = computeDatalabPeriod(referenceTime, 1);
    const budget = this.createBudget();

    const trends = await this.datalab.fetchTrends(
      terms.map((term) => ({ groupName: term, keywords: [term] })),
      { period, ages, anchor: anchorKeyword },
      budget,
    );

    return {
      date: period.endDate,
      ages,
      anchorKeyword,
      calls: toCallStats(budget),
      results: trends.map((trend) => ({
        term: trend.groupName,
        batch: trend.batch,
        ...toScoreFields(true, trend),
      })),
    };
  }

  private createBudget(): CallBudget {
    return new CallBudget(this.config.datalab.maxDatalabCallsPerRun);
  }
}

function toScoreFields(
  hasTerms: boolean,
  trend: DatalabGroupResult | undefined,
): ScoreFields {
  if (!hasTerms) return failedFields('noSearchTerm');
  if (!trend) return failedFields('apiError');
  if (trend.status === 'failed') return failedFields(trend.reason);

  const { ratio, anchorRatio } = trend;
  if (anchorRatio === 0) {
    return {
      ...failedFields('anchorZero'),
      yesterdayRatio: ratio,
      anchorRatio,
    };
  }
  return { yesterdayRatio: ratio, anchorRatio, score: ratio / anchorRatio };
}

function failedFields(failureReason: RankingFailureReason): ScoreFields {
  return {
    yesterdayRatio: null,
    anchorRatio: null,
    score: null,
    failureReason,
  };
}

function toCallStats(budget: CallBudget): DatalabCallStats {
  return {
    used: budget.used,
    limit: budget.limit,
    exhausted: budget.exhausted,
  };
}
