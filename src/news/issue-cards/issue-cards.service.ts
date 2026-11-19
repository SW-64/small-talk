import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { issueCardsConfig } from '../../config/issue-cards.config';
import { CallBudget } from '../common/call-budget';
import { TrendIssuesService } from '../trend-issues/trend-issues.service';
import { TrendIssuesRunOptions } from '../trend-issues/trend-issues.types';
import { GeminiBudgetExceededError, GeminiClient } from './gemini.client';
import {
  buildBatchPrompt,
  CardIssueInput,
  InvalidCardOutputError,
  parseBatchContent,
  pickArticles,
  PromptIssue,
  RESPONSE_SCHEMA,
  SYSTEM_INSTRUCTION,
} from './issue-card.prompt';

export interface CardTarget {
  category: string;
  issue: CardIssueInput;
}
import { IssueCard, IssueCardsResult } from './issue-cards.types';

export type IssueCardsRunOptions = Omit<TrendIssuesRunOptions, 'ranking'>;

/**
 * trend-issues 결과(랭킹 제외)에서 카테고리별 상위 이슈를 골라
 * Gemini 한 번의 요청으로 전체 이슈의 3줄 요약 + 스몰토크를 만든다. 실험용 — DB 저장 없음
 */
@Injectable()
export class IssueCardsService {
  private readonly logger = new Logger(IssueCardsService.name);

  constructor(
    private readonly trendIssues: TrendIssuesService,
    private readonly gemini: GeminiClient,
    @Inject(issueCardsConfig.KEY)
    private readonly config: ConfigType<typeof issueCardsConfig>,
  ) {}

  async run(
    options: IssueCardsRunOptions = {},
    now = new Date(),
  ): Promise<IssueCardsResult> {
    const trend = await this.trendIssues.run(
      { ...options, ranking: 'none' },
      now,
    );
    const budget = this.createBudget();

    // 제외어(사건·사고)·시황 플래그가 붙은 이슈는 스몰토크 소재로 부적절해 뺀다
    const targets = trend.categories.flatMap(({ category, issues }) =>
      issues
        .filter((issue) => !issue.excluded && !issue.marketReport)
        .slice(0, this.config.maxIssuesPerCategory)
        .map((issue) => ({ category, issue })),
    );
    this.logger.log(
      `[카드] 시작 — 이슈 ${targets.length}개, 모델 ${this.gemini.model}`,
    );

    const cards = await this.generateCards(targets, budget);

    return {
      window: trend.window,
      model: this.gemini.model,
      calls: {
        news: trend.stats.calls,
        gemini: {
          used: budget.used,
          limit: budget.limit,
          exhausted: budget.exhausted,
        },
      },
      categories: trend.categories.map(({ category, issues }) => {
        const clean = issues.filter((i) => !i.excluded && !i.marketReport);
        return {
          category,
          candidates: issues.length,
          droppedByFlags: issues.length - clean.length,
          cards: cards.filter((_, i) => targets[i].category === category),
        };
      }),
    };
  }

  get model(): string {
    return this.gemini.model;
  }

  // 실행 1회의 Gemini 호출 예산 (재시도 포함)
  createBudget(): CallBudget {
    return new CallBudget(this.config.gemini.maxCallsPerRun);
  }

  /**
   * 모든 이슈를 Gemini 요청 1번(실패 시 재시도)으로 만든다. 입력 순서대로 카드를 돌려주며,
   * 예외를 던지지 않고 실패는 status: 'failed' 카드로 표시한다
   */
  async generateCards(
    targets: CardTarget[],
    budget: CallBudget,
  ): Promise<IssueCard[]> {
    if (targets.length === 0) return [];

    const prompts: PromptIssue[] = targets.map(({ category, issue }, i) => ({
      id: `I${i + 1}`,
      category,
      issue,
      articles: pickArticles(issue.articles, this.config.maxArticlesPerIssue),
    }));
    const bases = targets.map(({ issue }) => ({
      issueRank: issue.rank,
      representativeTitle: issue.representativeTitle,
      publisherCount: issue.publisherCount,
      articleCount: issue.articleCount,
    }));
    this.logger.log(
      `[카드] Gemini 요청 — 이슈 ${targets.length}개를 한 번에, 모델 ${this.gemini.model}`,
    );

    let parsed: Awaited<ReturnType<typeof parseBatchContent>>;
    try {
      parsed = await this.gemini.generateJson(
        {
          systemInstruction: SYSTEM_INSTRUCTION,
          prompt: buildBatchPrompt(prompts),
          responseSchema: RESPONSE_SCHEMA,
        },
        (value) =>
          parseBatchContent(
            value,
            prompts.map((p) => ({ id: p.id, articleCount: p.articles.length })),
            this.config,
          ),
        budget,
      );
    } catch (error) {
      const reason =
        error instanceof GeminiBudgetExceededError
          ? 'budgetExceeded'
          : error instanceof InvalidCardOutputError ||
              error instanceof SyntaxError
            ? 'invalidOutput'
            : 'apiError';
      this.logger.error(`[카드] 전체 생성 실패 (${reason}): ${String(error)}`);
      return bases.map((base) => ({
        ...base,
        status: 'failed',
        reason,
        error: String(error),
      }));
    }

    const cards = prompts.map((prompt, i): IssueCard => {
      const content = parsed.get(prompt.id);
      if (!content || content instanceof InvalidCardOutputError) {
        const error = String(content ?? '응답 없음');
        this.logger.error(
          `[카드] ${prompt.category} ${prompt.issue.rank}위 "${prompt.issue.representativeTitle}" 생성 실패: ${error}`,
        );
        return {
          ...bases[i],
          status: 'failed',
          reason: 'invalidOutput',
          error,
        };
      }
      return {
        ...bases[i],
        status: 'ok',
        summary: content.summary.map(({ text, articleIds }) => ({
          text,
          sourceIds: articleIds,
        })),
        smalltalk: content.smalltalk,
        sources: prompt.articles.map((a, j) => ({
          id: j + 1,
          title: a.title,
          description: a.description,
          url: a.url,
          publisher: a.publisher,
          publishedAt: a.publishedAt,
        })),
      };
    });

    const failed = cards.filter((c) => c.status === 'failed').length;
    this.logger.log(
      `[카드] 완료 — 성공 ${cards.length - failed}개, 실패 ${failed}개, Gemini 호출 ${budget.used}/${budget.limit}회`,
    );
    return cards;
  }
}
