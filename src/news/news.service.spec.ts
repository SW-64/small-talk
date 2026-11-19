import { Logger } from '@nestjs/common';
import { trendIssuesConfig } from '../config/trend-issues.config';
import { CallBudget } from './common/call-budget';
import { NaverNewsResponse } from './dto/naver-news.types';
import { IssueCardsService } from './issue-cards/issue-cards.service';
import { NaverNewsClient } from './naver/naver-news.client';
import { NewsService } from './news.service';

const response = (title: string): NaverNewsResponse => ({
  lastBuildDate: '',
  total: 1,
  start: 1,
  display: 1,
  items: [
    {
      title: `<b>${title}</b>`,
      originallink: 'https://www.yna.co.kr/view/1',
      link: 'https://n.news.naver.com/mnews/article/001/1',
      description: '설명 &quot;인용&quot;',
      pubDate: 'Tue, 17 Nov 2026 09:12:00 +0900',
    },
  ],
});

describe('NewsService.sampleCards', () => {
  let search: jest.Mock;
  let generateCards: jest.Mock<Promise<{ status: string }[]>, [unknown[]]>;
  let service: NewsService;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    search = jest.fn((params: { query: string }) =>
      Promise.resolve(response(params.query)),
    );
    generateCards = jest.fn<Promise<{ status: string }[]>, [unknown[]]>(
      (targets) => Promise.resolve(targets.map(() => ({ status: 'ok' }))),
    );
    service = new NewsService(
      { search } as unknown as NaverNewsClient,
      {
        generateCards,
        createBudget: () => new CallBudget(10),
        model: 'test-model',
      } as unknown as IssueCardsService,
      trendIssuesConfig(),
    );
  });

  afterEach(() => jest.restoreAllMocks());

  it('카테고리마다 최신 기사 1건을 정리해 카드 생성에 넘긴다', async () => {
    const result = await service.sampleCards();

    expect(result.categories.map((c) => c.query)).toEqual([
      '경제',
      '테크',
      '문화',
      '사회',
      '환경',
    ]);
    expect(search).toHaveBeenCalledTimes(5);
    expect(generateCards).toHaveBeenCalledTimes(1);
    expect(generateCards.mock.calls[0][0]).toHaveLength(5);
    expect(result.categories.every((c) => c.card?.status === 'ok')).toBe(true);
    expect(result.categories[0].article).toMatchObject({
      title: '경제',
      description: '설명 "인용"',
      url: 'https://www.yna.co.kr/view/1',
      publisher: 'yna.co.kr',
      publishedAt: '2026-11-17T09:12:00+09:00',
    });
  });

  it('수집 실패나 결과 없음은 해당 카테고리만 비워 둔다', async () => {
    search
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({ ...response('x'), items: [] });

    const result = await service.sampleCards();

    expect(result.categories[0]).toMatchObject({ card: null, article: null });
    expect(result.categories[0].error).toBeDefined();
    expect(result.categories[1].error).toBe('검색 결과 없음');
    expect(generateCards).toHaveBeenCalledTimes(1);
    expect(generateCards.mock.calls[0][0]).toHaveLength(3);
    expect(result.categories[2].card).toEqual({ status: 'ok' });
  });
});
