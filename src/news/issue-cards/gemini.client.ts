import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { issueCardsConfig } from '../../config/issue-cards.config';
import { CallBudget } from '../common/call-budget';

export class GeminiApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly retryAfterMs?: number, // 429 응답의 RetryInfo.retryDelay
  ) {
    super(message);
    this.name = 'GeminiApiError';
  }
}

export class GeminiBudgetExceededError extends Error {
  constructor() {
    super('Gemini 호출 예산 소진');
    this.name = 'GeminiBudgetExceededError';
  }
}

export interface GeminiJsonRequest {
  systemInstruction: string;
  prompt: string;
  responseSchema: Record<string, unknown>;
}

interface GenerateContentResponse {
  candidates?: {
    content?: { parts?: { text?: string; thought?: boolean }[] };
    finishReason?: string;
  }[];
  promptFeedback?: { blockReason?: string };
}

interface GeminiErrorBody {
  error?: {
    message?: string;
    details?: { '@type'?: string; retryDelay?: string }[];
  };
}

// 오류 응답에서 짧은 메시지와 재시도 대기 시간("55s")을 뽑는다
export function parseErrorBody(text: string): {
  message: string;
  retryAfterMs?: number;
} {
  try {
    const { error } = JSON.parse(text) as GeminiErrorBody;
    const delay = error?.details?.find((d) => d.retryDelay)?.retryDelay;
    const seconds = delay ? parseFloat(delay) : NaN;
    return {
      message: error?.message?.split('\n')[0] ?? text,
      retryAfterMs: Number.isFinite(seconds)
        ? Math.ceil(seconds * 1000)
        : undefined,
    };
  } catch {
    return { message: text.slice(0, 300) };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Gemini generateContent REST 호출. JSON 응답 모드(responseSchema)로 받아 파싱한 값을 돌려준다.
 * parse 가 예외를 던지면(형식 불일치) 재시도 대상으로 취급한다.
 * 무료 등급 분당 요청 한도에 맞춰 요청 시작 간격을 벌리고, 429 는 응답이 알려준 시간만큼 기다린다.
 */
@Injectable()
export class GeminiClient {
  private readonly logger = new Logger(GeminiClient.name);
  private nextSlotAt = 0; // 다음 요청을 시작할 수 있는 시각(ms)

  constructor(
    @Inject(issueCardsConfig.KEY)
    private readonly config: ConfigType<typeof issueCardsConfig>,
  ) {}

  get model(): string {
    return this.config.gemini.model;
  }

  async generateJson<T>(
    request: GeminiJsonRequest,
    parse: (value: unknown) => T,
    budget: CallBudget,
  ): Promise<T> {
    const { maxRetries, retryBaseMs, maxRetryWaitMs } = this.config.gemini;
    for (let attempt = 0; ; attempt++) {
      if (!budget.tryAcquire()) throw new GeminiBudgetExceededError();
      await this.waitForSlot();
      try {
        const text = await this.request(request);
        return parse(JSON.parse(text));
      } catch (error) {
        const retryable =
          !(error instanceof GeminiApiError) ||
          error.status === undefined ||
          error.status === 429 ||
          error.status >= 500;
        if (!retryable || attempt >= maxRetries) throw error;

        const retryAfterMs =
          error instanceof GeminiApiError ? error.retryAfterMs : undefined;
        const waitMs = Math.min(
          retryAfterMs ?? retryBaseMs * 2 ** attempt,
          maxRetryWaitMs,
        );
        if (retryAfterMs !== undefined) {
          // 한도 초과면 다른 요청도 같이 기다리게 한다
          this.nextSlotAt = Math.max(this.nextSlotAt, Date.now() + waitMs);
        }
        this.logger.warn(
          `[카드] Gemini 오류(${String(error)}) — ${waitMs}ms 후 재시도 ${attempt + 1}/${maxRetries}`,
        );
        await sleep(waitMs);
      }
    }
  }

  // 요청 시작 시각을 동기적으로 예약하므로 병렬 호출에서도 간격이 지켜진다
  private async waitForSlot(): Promise<void> {
    const intervalMs = Math.ceil(60000 / this.config.gemini.requestsPerMinute);
    const now = Date.now();
    const startAt = Math.max(now, this.nextSlotAt);
    this.nextSlotAt = startAt + intervalMs;
    if (startAt > now) await sleep(startAt - now);
  }

  private async request({
    systemInstruction,
    prompt,
    responseSchema,
  }: GeminiJsonRequest): Promise<string> {
    const { apiKey, model, baseUrl, timeoutMs } = this.config.gemini;
    if (!apiKey) {
      throw new GeminiApiError('GOOGLE_API_KEY 가 설정되지 않았습니다', 0);
    }

    let res: Response;
    try {
      res = await fetch(`${baseUrl}/models/${model}:generateContent`, {
        method: 'POST',
        headers: {
          'x-goog-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemInstruction }] },
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema,
          },
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      throw new GeminiApiError(`요청 실패: ${String(error)}`);
    }

    if (!res.ok) {
      const { message, retryAfterMs } = parseErrorBody(await res.text());
      throw new GeminiApiError(
        `응답 오류 ${res.status}: ${message}`,
        res.status,
        retryAfterMs,
      );
    }

    const body = (await res.json()) as GenerateContentResponse;
    const blockReason = body.promptFeedback?.blockReason;
    if (blockReason) {
      throw new GeminiApiError(`프롬프트 차단: ${blockReason}`, 400);
    }
    const candidate = body.candidates?.[0];
    const text = (candidate?.content?.parts ?? [])
      .filter((p) => !p.thought)
      .map((p) => p.text ?? '')
      .join('');
    if (!text) {
      throw new GeminiApiError(
        `빈 응답 (finishReason: ${candidate?.finishReason ?? '없음'})`,
      );
    }
    return text;
  }
}
