import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { naverConfig } from '../../config/configuration';
import { rankingConfig } from '../../config/ranking.config';
import { CallBudget } from '../common/call-budget';
import { DatalabPeriod, fillMissingDates } from './datalab-period';
import { DailyRatio, RankingFailureReason } from './ranking.types';

export interface DatalabGroup {
  groupName: string;
  keywords: string[];
}

export interface DatalabRequest {
  period: DatalabPeriod;
  ages: string[];
}

export type DatalabGroupResult =
  | { groupName: string; batch: number; status: 'ok'; data: DailyRatio[] }
  | {
      groupName: string;
      batch: number;
      status: 'failed';
      reason: Exclude<RankingFailureReason, 'noSearchTerm'>;
    };

interface DatalabResponse {
  results: { title: string; data: DailyRatio[] }[];
}

class DatalabApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'DatalabApiError';
  }
}

class DatalabBudgetExceededError extends Error {}

export function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

@Injectable()
export class DatalabClient {
  private readonly logger = new Logger(DatalabClient.name);

  constructor(
    @Inject(naverConfig.KEY)
    private readonly naver: ConfigType<typeof naverConfig>,
    @Inject(rankingConfig.KEY)
    private readonly config: ConfigType<typeof rankingConfig>,
  ) {}

  // 그룹을 batchSize 개씩 순차 호출한다. 실패한 요청의 그룹만 failed 로 돌려주고 나머지는 계속한다
  async fetchTrends(
    groups: DatalabGroup[],
    request: DatalabRequest,
    budget: CallBudget,
  ): Promise<DatalabGroupResult[]> {
    const results: DatalabGroupResult[] = [];
    let budgetSkipped = 0;

    const batches = chunk(groups, this.config.datalab.batchSize);
    for (const [index, groupsInBatch] of batches.entries()) {
      const batch = index + 1;
      const failAll = (
        reason: 'apiError' | 'budgetExceeded',
      ): DatalabGroupResult[] =>
        groupsInBatch.map(({ groupName }) => ({
          groupName,
          batch,
          status: 'failed',
          reason,
        }));

      try {
        const response = await this.requestWithRetry(
          groupsInBatch,
          request,
          budget,
        );
        results.push(
          ...this.toResults(groupsInBatch, response, batch, request),
        );
      } catch (error) {
        if (error instanceof DatalabBudgetExceededError) {
          budgetSkipped += groupsInBatch.length;
          results.push(...failAll('budgetExceeded'));
        } else {
          this.logger.error(
            `[랭킹] 데이터랩 요청 ${batch} 실패 — 이슈 ${groupsInBatch.length}개 건너뜀 (${String(error)})`,
          );
          results.push(...failAll('apiError'));
        }
      }
    }

    if (budgetSkipped > 0) {
      this.logger.warn(
        `[랭킹] 데이터랩 호출 예산 ${budget.limit}회 소진 — 이슈 ${budgetSkipped}개 건너뜀`,
      );
    }
    return results;
  }

  private toResults(
    groups: DatalabGroup[],
    response: DatalabResponse,
    batch: number,
    { period }: DatalabRequest,
  ): DatalabGroupResult[] {
    const hasYesterday = response.results.some((r) =>
      r.data.some((d) => d.period === period.endDate),
    );
    if (!hasYesterday) {
      this.logger.warn(
        `[랭킹] 데이터랩 요청 ${batch}: ${period.endDate} 데이터 없음 — 아직 미반영일 가능성`,
      );
    }

    const byTitle = new Map(response.results.map((r) => [r.title, r.data]));
    return groups.map(({ groupName }) => {
      const data = byTitle.get(groupName);
      return data
        ? {
            groupName,
            batch,
            status: 'ok',
            data: fillMissingDates(data, period.dates),
          }
        : { groupName, batch, status: 'failed', reason: 'apiError' };
    });
  }

  // 429/5xx/네트워크 오류는 지수 백오프로 재시도. 실제 HTTP 요청마다 예산을 차감한다
  private async requestWithRetry(
    groups: DatalabGroup[],
    request: DatalabRequest,
    budget: CallBudget,
  ): Promise<DatalabResponse> {
    const { maxRetries, retryBaseMs } = this.config.datalab;
    for (let attempt = 0; ; attempt++) {
      if (!budget.tryAcquire()) throw new DatalabBudgetExceededError();
      try {
        return await this.request(groups, request);
      } catch (error) {
        const retryable =
          !(error instanceof DatalabApiError) ||
          error.status === undefined ||
          error.status === 429 ||
          error.status >= 500;
        if (!retryable || attempt >= maxRetries) throw error;

        const waitMs = retryBaseMs * 2 ** attempt;
        this.logger.warn(
          `[랭킹] 데이터랩 오류(${String(error)}) — ${waitMs}ms 후 재시도 ${attempt + 1}/${maxRetries}`,
        );
        await new Promise((resolve) => setTimeout(resolve, waitMs));
      }
    }
  }

  private async request(
    groups: DatalabGroup[],
    { period, ages }: DatalabRequest,
  ): Promise<DatalabResponse> {
    const { keyId, key, datalabUrl } = this.naver;
    if (!keyId || !key) {
      throw new DatalabApiError('NAVER API HUB 키가 설정되지 않았습니다', 0);
    }

    let res: Response;
    try {
      res = await fetch(datalabUrl, {
        method: 'POST',
        headers: {
          'X-NCP-APIGW-API-KEY-ID': keyId,
          'X-NCP-APIGW-API-KEY': key,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          startDate: period.startDate,
          endDate: period.endDate,
          timeUnit: 'date',
          keywordGroups: groups,
          ...(ages.length > 0 ? { ages } : {}),
        }),
        signal: AbortSignal.timeout(this.config.datalab.timeoutMs),
      });
    } catch (error) {
      throw new DatalabApiError(`요청 실패: ${String(error)}`);
    }

    if (!res.ok) {
      throw new DatalabApiError(
        `응답 오류 ${res.status}: ${await res.text()}`,
        res.status,
      );
    }
    return (await res.json()) as DatalabResponse;
  }
}
