import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NaverNewsResponse } from '../dto/naver-news.types';

export interface NaverNewsSearchParams {
  query: string;
  display: number;
  start: number;
  sort: 'date' | 'sim';
}

export interface NaverNewsRequestOptions {
  maxRetries?: number;
  retryBaseMs?: number;
  timeoutMs?: number;
  // 재시도를 포함한 실제 HTTP 요청 직전마다 호출. false 면 요청하지 않고 중단
  acquire?: () => boolean;
}

export class NaverApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'NaverApiError';
  }
}

export class NaverBudgetExceededError extends Error {
  constructor() {
    super('NAVER API 호출 예산 소진');
    this.name = 'NaverBudgetExceededError';
  }
}

@Injectable()
export class NaverNewsClient {
  private readonly logger = new Logger(NaverNewsClient.name);

  constructor(private readonly config: ConfigService) {}

  // 429/5xx/네트워크 오류는 지수 백오프로 최대 maxRetries회 재시도, 그 외 오류는 즉시 실패
  async search(
    params: NaverNewsSearchParams,
    {
      maxRetries = 0,
      retryBaseMs = 500,
      timeoutMs = 5000,
      acquire,
    }: NaverNewsRequestOptions = {},
  ): Promise<NaverNewsResponse> {
    for (let attempt = 0; ; attempt++) {
      if (acquire && !acquire()) throw new NaverBudgetExceededError();
      try {
        return await this.request(params, timeoutMs);
      } catch (error) {
        const retryable =
          !(error instanceof NaverApiError) ||
          error.status === undefined ||
          error.status === 429 ||
          error.status >= 500;
        if (!retryable || attempt >= maxRetries) throw error;

        const waitMs = retryBaseMs * 2 ** attempt;
        this.logger.warn(
          `NAVER API 오류(${describe(error)}) — ${waitMs}ms 후 재시도 ${attempt + 1}/${maxRetries} (query=${params.query}, start=${params.start})`,
        );
        await sleep(waitMs);
      }
    }
  }

  private async request(
    { query, display, start, sort }: NaverNewsSearchParams,
    timeoutMs: number,
  ): Promise<NaverNewsResponse> {
    const keyId = this.config.get<string>('naver.keyId');
    const key = this.config.get<string>('naver.key');
    const newsUrl = this.config.get<string>('naver.newsUrl');
    if (!keyId || !key) {
      throw new NaverApiError('NAVER API HUB 키가 설정되지 않았습니다', 0);
    }

    const qs = new URLSearchParams({
      query,
      display: String(display),
      start: String(start),
      sort,
    });

    let res: Response;
    try {
      res = await fetch(`${newsUrl}?${qs.toString()}`, {
        headers: {
          'X-NCP-APIGW-API-KEY-ID': keyId,
          'X-NCP-APIGW-API-KEY': key,
        },
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      throw new NaverApiError(`요청 실패: ${String(error)}`);
    }

    if (!res.ok) {
      throw new NaverApiError(
        `응답 오류 ${res.status}: ${await res.text()}`,
        res.status,
      );
    }

    return (await res.json()) as NaverNewsResponse;
  }
}

function describe(error: unknown): string {
  return error instanceof NaverApiError && error.status
    ? String(error.status)
    : String(error);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
