import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { rankingConfig } from '../../config/ranking.config';
import { CallBudget } from '../common/call-budget';
import { DatalabClient, DatalabGroupResult } from './datalab.client';
import { computeDatalabPeriod } from './datalab-period';
import { formatRankingSummary } from './ranking-summary';
import {
  DatalabCallStats,
  DatalabTestResult,
  RankedIssue,
  RankingFailureReason,
  RankingIssueInput,
  RankingResult,
  SpikeFields,
} from './ranking.types';
import { SearchTermService } from './search-term.service';
import { computeSpike } from './spike';

/**
 * 이슈 목록을 입력받아 데이터랩 검색 추이로 급상승도를 계산하고 순위를 매긴다.
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

  // referenceTime 의 KST 날짜 기준 "어제"까지를 조회 기간으로 쓴다
  async rank(
    issues: RankingIssueInput[],
    { referenceTime }: { referenceTime: Date },
  ): Promise<RankingResult> {
    const { ages, days, overallTopN, overallPrimaryN } = this.config;
    const period = computeDatalabPeriod(referenceTime, days);
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
      { period, ages },
      budget,
    );
    const trendById = new Map(trends.map((t) => [t.groupName, t]));

    const ranked: RankedIssue[] = withTerms.map(({ issue, terms }) => ({
      id: issue.id,
      category: issue.category,
      representativeTitle: issue.representativeTitle,
      publisherCount: issue.publisherCount,
      searchTerms: terms,
      ...this.toSpikeFields(terms.length > 0, trendById.get(issue.id)),
    }));

    const categories = [...new Set(issues.map((i) => i.category))].map(
      (category) => ({
        category,
        issues: ranked
          .filter((issue) => issue.category === category)
          .sort(compareIssues)
          .map((issue, index) => ({ ...issue, rank: index + 1 })),
      }),
    );

    const overall = [...ranked]
      .sort(compareIssues)
      .slice(0, overallTopN)
      .map((issue, index) => ({
        ...issue,
        rank: index + 1,
        tier: index < overallPrimaryN ? ('top' as const) : ('reserve' as const),
      }));

    const failed = ranked.filter((issue) => issue.spike === null).length;
    const result: RankingResult = {
      period: { startDate: period.startDate, endDate: period.endDate },
      ages,
      calls: toCallStats(budget),
      candidates: {
        total: ranked.length,
        ranked: ranked.length - failed,
        failed,
      },
      categories,
      overall,
    };

    for (const line of formatRankingSummary(result)) this.logger.log(line);
    return result;
  }

  // 개발용: 검색어를 그대로 조회해 일별 ratio 와 spike 를 돌려준다
  async testTerms(
    terms: string[],
    options: { ages?: string[]; days?: number } = {},
    referenceTime = new Date(),
  ): Promise<DatalabTestResult> {
    const ages = options.ages ?? this.config.ages;
    const period = computeDatalabPeriod(
      referenceTime,
      options.days ?? this.config.days,
    );
    const budget = this.createBudget();

    const trends = await this.datalab.fetchTrends(
      terms.map((term) => ({ groupName: term, keywords: [term] })),
      { period, ages },
      budget,
    );

    return {
      period: { startDate: period.startDate, endDate: period.endDate },
      ages,
      calls: toCallStats(budget),
      results: trends.map((trend) => ({
        term: trend.groupName,
        batch: trend.batch,
        ...this.toSpikeFields(true, trend),
      })),
    };
  }

  private createBudget(): CallBudget {
    return new CallBudget(this.config.datalab.maxDatalabCallsPerRun);
  }

  private toSpikeFields(
    hasTerms: boolean,
    trend: DatalabGroupResult | undefined,
  ): SpikeFields {
    if (!hasTerms) return failedFields('noSearchTerm');
    if (!trend) return failedFields('apiError');
    if (trend.status === 'failed') return failedFields(trend.reason);

    return {
      dailyRatios: trend.data,
      ...computeSpike(
        trend.data.map((d) => d.ratio),
        this.config.spike,
      ),
    };
  }
}

function failedFields(failureReason: RankingFailureReason): SpikeFields {
  return {
    dailyRatios: [],
    yesterdayRatio: null,
    previousAverage: null,
    spike: null,
    flags: ['rankingFailed'],
    failureReason,
  };
}

// spike 내림차순, 동점이면 언론사 수. 실패(null)는 뒤에서 언론사 수 순
function compareIssues(a: RankedIssue, b: RankedIssue): number {
  if (a.spike === null || b.spike === null) {
    if (a.spike !== b.spike) return a.spike === null ? 1 : -1;
    return b.publisherCount - a.publisherCount;
  }
  return b.spike - a.spike || b.publisherCount - a.publisherCount;
}

function toCallStats(budget: CallBudget): DatalabCallStats {
  return {
    used: budget.used,
    limit: budget.limit,
    exhausted: budget.exhausted,
  };
}
