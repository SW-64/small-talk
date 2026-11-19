import { BadRequestException, Logger } from '@nestjs/common';
import { trendIssuesConfig } from '../../config/trend-issues.config';
import { RankingService } from '../ranking/ranking.service';
import { RankingIssueInput, RankingResult } from '../ranking/ranking.types';
import { CollectService } from './collect.service';
import { TrendIssuesService } from './trend-issues.service';
import {
  KeywordCollectResult,
  KeywordTarget,
  RawArticle,
} from './trend-issues.types';

const NOW = new Date('2026-10-28T12:00:00+09:00');
const TITLE = '반도체 수출 사상 최대 기록 경신';

const rawArticle = (
  publisher: string,
  category: string,
  keyword: string,
  title = TITLE,
): RawArticle => ({
  item: {
    title,
    originallink: `https://www.${publisher}/${title.length}`,
    link: `https://www.${publisher}/${title.length}`,
    description: '',
    pubDate: '',
  },
  category,
  keyword,
  publishedAt: new Date('2026-10-28T01:00:00+09:00'),
});

describe('TrendIssuesService', () => {
  let collectAll: jest.Mock<Promise<KeywordCollectResult[]>, [KeywordTarget[]]>;
  let rank: jest.Mock<
    Promise<RankingResult>,
    [RankingIssueInput[], { referenceTime: Date }]
  >;
  let service: TrendIssuesService;

  const collected = (
    target: KeywordTarget,
    articles: RawArticle[] = [],
  ): KeywordCollectResult => ({
    ...target,
    pages: 1,
    calls: 1,
    articles,
    failed: false,
    limitReached: false,
    skipped: false,
    budgetStopped: false,
  });

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    collectAll = jest.fn((targets: KeywordTarget[]) =>
      Promise.resolve(targets.map((t) => collected(t))),
    );
    rank = jest.fn<
      Promise<RankingResult>,
      [RankingIssueInput[], { referenceTime: Date }]
    >(() => Promise.resolve({} as RankingResult));
    service = new TrendIssuesService(
      { collectAll } as unknown as CollectService,
      trendIssuesConfig(),
      { rank } as unknown as RankingService,
    );
  });

  afterEach(() => jest.restoreAllMocks());

  it('기본은 설정의 전체 카테고리·키워드를 실행한다', async () => {
    const result = await service.run({}, NOW);
    expect(collectAll.mock.calls[0][0]).toHaveLength(40);
    expect(result.categories.map((c) => c.category)).toEqual([
      'economy',
      'tech',
      'culture',
      'society',
      'environment',
    ]);
    expect(result.window).toEqual({
      type: 'previousDay',
      start: '2026-10-27T06:00:00+09:00',
      end: '2026-10-28T06:00:00+09:00',
    });
  });

  it('categories 와 maxKeywordsPerCategory 로 대상을 줄이고 설정 순서를 유지한다', async () => {
    const result = await service.run(
      { categories: ['tech', 'economy'], maxKeywordsPerCategory: 2 },
      NOW,
    );
    expect(collectAll.mock.calls[0][0].map((t) => t.keyword)).toEqual([
      '금리',
      '환율',
      'AI',
      '스마트폰',
    ]);
    expect(result.categories.map((c) => c.category)).toEqual([
      'economy',
      'tech',
    ]);
  });

  it('계절 키워드 표시를 통계까지 전달한다', async () => {
    const result = await service.run({ categories: ['environment'] }, NOW);
    const seasonal = result.stats.perKeyword
      .filter((k) => k.seasonal)
      .map((k) => k.keyword);
    expect(seasonal).toEqual(['한파']);
  });

  it('last24h 는 실행 시각 기준 최근 24시간이다', async () => {
    const result = await service.run({ window: 'last24h' }, NOW);
    expect(result.window).toEqual({
      type: 'last24h',
      start: '2026-10-27T12:00:00+09:00',
      end: '2026-10-28T12:00:00+09:00',
    });
  });

  it('알 수 없는 카테고리는 호출 없이 400', async () => {
    await expect(
      service.run({ categories: ['nope'] }, NOW),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(collectAll).not.toHaveBeenCalled();
  });

  it('date 와 last24h 를 함께 주면 호출 없이 400', async () => {
    await expect(
      service.run({ date: '2026-10-28', window: 'last24h' }, NOW),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(collectAll).not.toHaveBeenCalled();
  });

  it('카테고리를 넘어 묶고 이슈는 한 카테고리에만 배정하며 기여도를 계산한다', async () => {
    collectAll.mockImplementation((targets) =>
      Promise.resolve(
        targets.map((t) => {
          if (t.category === 'economy' && t.keyword === '환율') {
            return collected(t, [rawArticle('mk.co.kr', 'economy', '환율')]);
          }
          if (t.category === 'tech' && t.keyword === '반도체') {
            return collected(t, [
              rawArticle('chosun.com', 'tech', '반도체'),
              rawArticle('donga.com', 'tech', '반도체'),
            ]);
          }
          return collected(t);
        }),
      ),
    );

    const result = await service.run({}, NOW);
    const [economy, tech] = result.categories;

    expect(economy.issues).toHaveLength(0);
    expect(tech.issues).toHaveLength(1);
    expect(tech.issues[0]).toMatchObject({
      rank: 1,
      publisherCount: 3,
      majorPublisherCount: 3,
      articleCount: 3,
    });
    expect(tech.articles + economy.articles).toBe(3);

    const stat = (keyword: string) =>
      result.stats.perKeyword.find((k) => k.keyword === keyword);
    expect(stat('반도체')).toMatchObject({ topIssues: 1, soloTopIssues: 0 });
    expect(stat('환율')).toMatchObject({ topIssues: 1, soloTopIssues: 0 });
    expect(stat('부동산')).toMatchObject({ topIssues: 0, soloTopIssues: 0 });
  });

  describe('랭킹', () => {
    const FLAGGED = '검찰 수사 착수 소식에 업계 전체 긴장';

    beforeEach(() => {
      collectAll.mockImplementation((targets) =>
        Promise.resolve(
          targets.map((t) =>
            t.keyword === '반도체'
              ? collected(t, [
                  rawArticle('chosun.com', 'tech', '반도체'),
                  rawArticle('donga.com', 'tech', '반도체'),
                  rawArticle('chosun.com', 'tech', '반도체', FLAGGED),
                  rawArticle('donga.com', 'tech', '반도체', FLAGGED),
                ])
              : collected(t),
          ),
        ),
      );
    });

    it('기본값이면 데이터랩 랭킹을 호출하지 않는다', async () => {
      const result = await service.run({}, NOW);
      expect(rank).not.toHaveBeenCalled();
      expect(result.ranking).toBeUndefined();
    });

    it('플래그 없는 묶음만 후보로 넘기고 수집 기간 끝을 기준 시각으로 쓴다', async () => {
      const result = await service.run({ ranking: 'datalab' }, NOW);

      expect(rank).toHaveBeenCalledTimes(1);
      const [inputs, { referenceTime }] = rank.mock.calls[0];
      expect(inputs).toEqual([
        {
          id: 'tech-1',
          category: 'tech',
          representativeTitle: TITLE,
          publisherCount: 2,
          titles: [TITLE, TITLE],
        },
      ]);
      expect(referenceTime).toEqual(new Date('2026-10-28T06:00:00+09:00'));
      expect(result.ranking?.droppedByFlags).toBe(1);
    });
  });
});
