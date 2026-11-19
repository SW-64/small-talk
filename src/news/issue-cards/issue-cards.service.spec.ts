import { Logger } from '@nestjs/common';
import { issueCardsConfig } from '../../config/issue-cards.config';
import { TrendIssuesService } from '../trend-issues/trend-issues.service';
import {
  TrendIssue,
  TrendIssuesResult,
} from '../trend-issues/trend-issues.types';
import { GeminiClient } from './gemini.client';
import { IssueCardsRunOptions, IssueCardsService } from './issue-cards.service';

const issue = (rank: number, flags: Partial<TrendIssue> = {}): TrendIssue => ({
  rank,
  representativeTitle: `이슈 ${rank}`,
  publisherCount: 3,
  majorPublisherCount: 2,
  articleCount: 1,
  keywords: [],
  publishers: [],
  majorPublishers: [],
  excluded: false,
  excludeReasons: [],
  marketReport: false,
  marketReportWords: [],
  articles: [
    {
      title: `기사 ${rank}`,
      description: '요약',
      url: `https://a.com/${rank}`,
      publisher: 'a.com',
      publishedAt: '2026-11-16T10:00:00+09:00',
      sources: [],
    },
  ],
  ...flags,
});

const trendResult = (issues: TrendIssue[]): TrendIssuesResult =>
  ({
    window: { type: 'previousDay', start: 's', end: 'e' },
    stats: { calls: { used: 1, limit: 700, exhausted: false } },
    categories: [
      {
        category: 'economy',
        articles: 0,
        publishers: 0,
        clusters: 0,
        qualified: 0,
        issues,
      },
    ],
  }) as unknown as TrendIssuesResult;

const content = (issueId: string) => ({
  issueId,
  summary: [1, 2, 3].map((n) => ({ text: `줄 ${n}`, articleIds: [1] })),
  smalltalk: ['a', 'b', 'c'],
});

// 프롬프트의 이슈 수만큼 카드를 돌려주는 가짜 응답 (skip 에 든 id 는 빼고)
const respond =
  (skip: string[] = []) =>
  (req: { prompt: string }, parse: (v: unknown) => unknown) => {
    const ids = [...req.prompt.matchAll(/=== 이슈 (I\d+) ===/g)].map(
      (m) => m[1],
    );
    return Promise.resolve(
      parse({
        cards: ids.filter((id) => !skip.includes(id)).map((id) => content(id)),
      }),
    );
  };

describe('IssueCardsService', () => {
  let trendRun: jest.Mock<Promise<TrendIssuesResult>, [IssueCardsRunOptions?]>;
  let generateJson: jest.Mock;
  let service: IssueCardsService;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    trendRun = jest.fn<Promise<TrendIssuesResult>, [IssueCardsRunOptions?]>();
    generateJson = jest.fn(respond());
    service = new IssueCardsService(
      { run: trendRun } as unknown as TrendIssuesService,
      { generateJson, model: 'test-model' } as unknown as GeminiClient,
      issueCardsConfig(),
    );
  });

  afterEach(() => jest.restoreAllMocks());

  it('랭킹 없이 실행하고, 플래그 이슈를 빼고 카테고리당 최대 5개를 Gemini 1번으로 만든다', async () => {
    trendRun.mockResolvedValue(
      trendResult([
        issue(1, { excluded: true }),
        issue(2),
        issue(3, { marketReport: true }),
        ...[4, 5, 6, 7, 8].map((r) => issue(r)),
      ]),
    );

    const result = await service.run({ categories: ['economy'] });

    expect(trendRun.mock.calls[0][0]).toEqual({
      categories: ['economy'],
      ranking: 'none',
    });
    expect(generateJson).toHaveBeenCalledTimes(1);
    const [category] = result.categories;
    expect(category.droppedByFlags).toBe(2);
    expect(category.cards.map((c) => c.issueRank)).toEqual([2, 4, 5, 6, 7]);
    expect(category.cards[0]).toMatchObject({
      status: 'ok',
      summary: [{ text: '줄 1', sourceIds: [1] }, {}, {}],
      smalltalk: ['a', 'b', 'c'],
      sources: [{ id: 1, url: 'https://a.com/2' }],
    });
  });

  it('응답에서 빠진 이슈만 실패로 표시한다', async () => {
    trendRun.mockResolvedValue(trendResult([issue(1), issue(2)]));
    generateJson.mockImplementationOnce(respond(['I1']));

    const result = await service.run();

    expect(result.categories[0].cards.map((c) => c.status)).toEqual([
      'failed',
      'ok',
    ]);
    expect(result.categories[0].cards[0]).toMatchObject({
      reason: 'invalidOutput',
    });
  });

  it('요청 자체가 실패하면 전체 카드가 실패로 표시된다', async () => {
    trendRun.mockResolvedValue(trendResult([issue(1), issue(2)]));
    generateJson.mockRejectedValueOnce(new Error('boom'));

    const result = await service.run();

    expect(result.categories[0].cards).toMatchObject([
      { status: 'failed', reason: 'apiError' },
      { status: 'failed', reason: 'apiError' },
    ]);
  });

  it('이슈가 없으면 Gemini 를 호출하지 않는다', async () => {
    trendRun.mockResolvedValue(trendResult([]));
    await service.run();
    expect(generateJson).not.toHaveBeenCalled();
  });
});
