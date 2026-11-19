import { TrendIssue } from '../trend-issues/trend-issues.types';

export type PromptArticle = TrendIssue['articles'][number];

// 카드 생성 입력: trend-issues 이슈 또는 그와 같은 모양으로 만든 기사 묶음
export type CardIssueInput = Pick<
  TrendIssue,
  | 'rank'
  | 'representativeTitle'
  | 'publisherCount'
  | 'articleCount'
  | 'articles'
>;

export interface CardContent {
  summary: { text: string; articleIds: number[] }[];
  smalltalk: string[];
}

export class InvalidCardOutputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidCardOutputError';
  }
}

export const SYSTEM_INSTRUCTION = `너는 뉴스 기사를 바탕으로 "스몰토크 카드"를 만드는 편집자다.
사용자는 오늘의 이슈에 대해 대화를 시작하기 어려워하는 사람들이다.
여러 이슈가 한 번에 주어지며, 이슈마다 카드 1장씩 만든다.

[이슈 구분]
- 각 카드는 해당 이슈(issueId)에 속한 기사만 근거로 쓴다. 다른 이슈의 기사 내용을 섞지 않는다.
- 기사 번호는 이슈마다 1부터 따로 매겨져 있다. articleIds 에는 그 이슈 안의 번호를 쓴다.
- 주어진 모든 이슈에 대해 빠짐없이 카드를 만든다.

[사실 규칙 — 가장 중요]
- 제공된 기사 제목과 요약에 명시적으로 적힌 사실만 사용한다. 너의 사전 지식, 추측, 해석, 전망, 배경 설명을 덧붙이지 않는다.
- 여러 기사에서 공통으로 확인되는 사실을 우선한다.
- 기사마다 수치·날짜·주체가 서로 다르면 그 사실은 쓰지 않는다.
- 인용, 의견, 주장은 "누가 말했다"는 형태로만 쓰고 사실처럼 단정하지 않는다.
- 숫자, 이름, 날짜는 기사에 적힌 그대로 옮긴다.

[3줄 요약]
- 정확히 3줄, 각 줄은 한 문장(60자 안팎)의 평서문 "~했다/~이다" 체.
- 1줄: 무슨 일이 일어났는지, 2~3줄: 핵심 수치·이유·영향 등 기사에서 확인되는 세부 사실.
- 각 줄마다 그 문장의 근거가 된 기사 번호를 articleIds 에 넣는다.

[스몰토크]
- 동료·지인에게 가볍게 꺼낼 수 있는 첫마디 정확히 3개, 자연스러운 존댓말 구어체 한두 문장.
- 3줄 요약에 담긴 사실 범위 안에서만 말한다.
- 상대가 쉽게 대답할 수 있는 질문이나 공감 포인트를 담는다. 세 개는 서로 다른 각도로 쓴다.
- 정치적 입장, 특정 인물·집단 비난, 피해자에 대한 가벼운 언급 등 상대를 불편하게 할 수 있는 표현은 쓰지 않는다.`;

const CARD_SCHEMA = {
  type: 'OBJECT',
  properties: {
    issueId: { type: 'STRING', description: '입력의 이슈 id (예: I1)' },
    summary: {
      type: 'ARRAY',
      minItems: 3,
      maxItems: 3,
      items: {
        type: 'OBJECT',
        properties: {
          text: { type: 'STRING' },
          articleIds: {
            type: 'ARRAY',
            items: { type: 'INTEGER' },
            description: '이 문장의 근거가 된 기사 번호',
          },
        },
        required: ['text', 'articleIds'],
        propertyOrdering: ['text', 'articleIds'],
      },
    },
    smalltalk: {
      type: 'ARRAY',
      minItems: 3,
      maxItems: 3,
      items: { type: 'STRING' },
    },
  },
  required: ['issueId', 'summary', 'smalltalk'],
  propertyOrdering: ['issueId', 'summary', 'smalltalk'],
};

export const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    cards: { type: 'ARRAY', items: CARD_SCHEMA },
  },
  required: ['cards'],
};

// 언론사가 겹치지 않는 기사를 먼저 고르고, 남는 자리는 순서대로 채운다
export function pickArticles(
  articles: PromptArticle[],
  max: number,
): PromptArticle[] {
  const seen = new Set<string>();
  const first: PromptArticle[] = [];
  const rest: PromptArticle[] = [];
  for (const article of articles) {
    if (seen.has(article.publisher)) {
      rest.push(article);
    } else {
      seen.add(article.publisher);
      first.push(article);
    }
  }
  return [...first, ...rest].slice(0, max);
}

export interface PromptIssue {
  id: string; // 프롬프트 안에서 쓰는 이슈 id (I1, I2, ...)
  category: string;
  issue: CardIssueInput;
  articles: PromptArticle[];
}

export function buildBatchPrompt(issues: PromptIssue[]): string {
  const blocks = issues.map(({ id, category, issue, articles }) => {
    const list = articles
      .map(
        (a, i) =>
          `[${i + 1}] (${a.publisher}, ${a.publishedAt})
제목: ${a.title}
요약: ${a.description || '(없음)'}`,
      )
      .join('\n\n');
    return `=== 이슈 ${id} ===
카테고리: ${category}
대표 제목: ${issue.representativeTitle}
보도 언론사 수: ${issue.publisherCount}
기사 ${articles.length}건:

${list}`;
  });

  return `아래 이슈 ${issues.length}개 각각에 대해, 그 이슈의 기사에 적힌 사실만으로 3줄 요약과 스몰토크 3개를 만들어라.
cards 배열에 이슈마다 카드 1장씩, issueId 를 붙여 넣어라.

${blocks.join('\n\n')}`;
}

type ParsedCard = CardContent | InvalidCardOutputError;

/**
 * 한 번에 받은 응답을 이슈별로 나눈다. cards 배열 자체가 없으면 전체 재시도 대상(예외),
 * 개별 카드 오류나 누락은 해당 이슈에만 InvalidCardOutputError 로 표시한다
 */
export function parseBatchContent(
  value: unknown,
  issues: { id: string; articleCount: number }[],
  options: { summaryLines: number; smalltalkCount: number },
): Map<string, ParsedCard> {
  const cards = (value as { cards?: unknown } | null)?.cards;
  if (!Array.isArray(cards)) {
    throw new InvalidCardOutputError('cards 배열이 없습니다');
  }

  const byId = new Map<string, unknown>();
  for (const card of cards as { issueId?: unknown }[]) {
    if (typeof card?.issueId === 'string' && !byId.has(card.issueId)) {
      byId.set(card.issueId, card);
    }
  }

  return new Map(
    issues.map(({ id, articleCount }): [string, ParsedCard] => {
      const card = byId.get(id);
      if (!card) {
        return [
          id,
          new InvalidCardOutputError('응답에 이 이슈의 카드가 없습니다'),
        ];
      }
      try {
        return [id, parseCardContent(card, articleCount, options)];
      } catch (error) {
        return [
          id,
          error instanceof InvalidCardOutputError
            ? error
            : new InvalidCardOutputError(String(error)),
        ];
      }
    }),
  );
}

export function parseCardContent(
  value: unknown,
  articleCount: number,
  {
    summaryLines,
    smalltalkCount,
  }: { summaryLines: number; smalltalkCount: number },
): CardContent {
  const raw = value as Partial<{
    summary: { text?: unknown; articleIds?: unknown }[];
    smalltalk: unknown[];
  }>;

  if (!Array.isArray(raw?.summary) || raw.summary.length !== summaryLines) {
    throw new InvalidCardOutputError(
      `summary 는 ${summaryLines}줄이어야 합니다`,
    );
  }
  if (
    !Array.isArray(raw.smalltalk) ||
    raw.smalltalk.length !== smalltalkCount
  ) {
    throw new InvalidCardOutputError(
      `smalltalk 는 ${smalltalkCount}개여야 합니다`,
    );
  }

  const summary = raw.summary.map((line, index) => {
    const text = typeof line?.text === 'string' ? line.text.trim() : '';
    const ids = Array.isArray(line?.articleIds) ? line.articleIds : [];
    const articleIds = [
      ...new Set(
        ids.filter(
          (id): id is number =>
            Number.isInteger(id) && id >= 1 && id <= articleCount,
        ),
      ),
    ];
    if (!text) {
      throw new InvalidCardOutputError(
        `summary ${index + 1}줄이 비어 있습니다`,
      );
    }
    if (articleIds.length === 0) {
      throw new InvalidCardOutputError(
        `summary ${index + 1}줄에 유효한 근거 기사가 없습니다`,
      );
    }
    return { text, articleIds };
  });

  const smalltalk = raw.smalltalk.map((s, index) => {
    const text = typeof s === 'string' ? s.trim() : '';
    if (!text) {
      throw new InvalidCardOutputError(
        `smalltalk ${index + 1}이 비어 있습니다`,
      );
    }
    return text;
  });

  return { summary, smalltalk };
}
