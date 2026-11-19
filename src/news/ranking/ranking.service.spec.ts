import { Logger } from '@nestjs/common';
import { rankingConfig } from '../../config/ranking.config';
import {
  DatalabClient,
  DatalabGroup,
  DatalabGroupResult,
} from './datalab.client';
import { RankingService } from './ranking.service';
import { RankingIssueInput } from './ranking.types';
import { SearchTermService } from './search-term.service';

const REFERENCE = new Date('2026-11-08T06:00:00+09:00');

const issue = (
  id: string,
  category: string,
  publisherCount = 3,
): RankingIssueInput => ({
  id,
  category,
  representativeTitle: `${id} 제목`,
  publisherCount,
  titles: [`${id}키워드 소식`, `${id}키워드 소식`],
});

const ok = (groupName: string, yesterday: number, batch = 1) =>
  ({
    groupName,
    batch,
    status: 'ok',
    data: [
      { period: '2026-11-06', ratio: 10 },
      { period: '2026-11-07', ratio: yesterday },
    ],
  }) satisfies DatalabGroupResult;

const failed = (groupName: string) =>
  ({
    groupName,
    batch: 1,
    status: 'failed',
    reason: 'apiError',
  }) satisfies DatalabGroupResult;

describe('RankingService', () => {
  let fetchTrends: jest.Mock<Promise<DatalabGroupResult[]>, [DatalabGroup[]]>;
  let service: RankingService;

  const respond = (results: DatalabGroupResult[]) =>
    fetchTrends.mockResolvedValue(results);

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    fetchTrends = jest.fn<Promise<DatalabGroupResult[]>, [DatalabGroup[]]>();
    const config = rankingConfig();
    service = new RankingService(
      { fetchTrends } as unknown as DatalabClient,
      new SearchTermService(config),
      config,
    );
  });

  afterEach(() => jest.restoreAllMocks());

  it('카테고리별로 spike 내림차순, 동점이면 언론사 수 내림차순이다', async () => {
    respond([ok('a', 10), ok('b', 40), ok('c', 40)]);
    const result = await service.rank(
      [issue('a', 'tech'), issue('b', 'tech', 2), issue('c', 'tech', 9)],
      { referenceTime: REFERENCE },
    );
    expect(result.categories[0].issues.map((i) => [i.rank, i.id])).toEqual([
      [1, 'c'],
      [2, 'b'],
      [3, 'a'],
    ]);
  });

  it('요청이 달라도 이슈 자신의 값으로만 spike 를 계산한다', async () => {
    // b 는 다른 요청이라 ratio 절대값이 작지만 자기 평균 대비 상승폭은 같다
    fetchTrends.mockResolvedValue([
      ok('a', 40, 1),
      {
        groupName: 'b',
        batch: 2,
        status: 'ok',
        data: [
          { period: '2026-11-06', ratio: 1 },
          { period: '2026-11-07', ratio: 4 },
        ],
      },
    ]);
    const result = await service.rank(
      [issue('a', 'tech'), issue('b', 'tech')],
      { referenceTime: REFERENCE },
    );
    expect(result.categories[0].issues.map((i) => i.spike)).toEqual([4, 4]);
  });

  it('호출 실패 이슈는 spike null 과 플래그를 달고 뒤에 언론사 수 순으로 둔다', async () => {
    respond([failed('a'), ok('b', 1), failed('c')]);
    const result = await service.rank(
      [issue('a', 'tech', 3), issue('b', 'tech', 2), issue('c', 'tech', 8)],
      { referenceTime: REFERENCE },
    );
    const issues = result.categories[0].issues;
    expect(issues.map((i) => i.id)).toEqual(['b', 'c', 'a']);
    expect(issues[1]).toMatchObject({
      spike: null,
      flags: ['rankingFailed'],
      failureReason: 'apiError',
    });
    expect(result.candidates).toEqual({ total: 3, ranked: 1, failed: 2 });
  });

  it('검색어를 뽑지 못한 이슈는 호출 없이 noSearchTerm 이다', async () => {
    respond([]);
    const result = await service.rank(
      [{ ...issue('a', 'tech'), titles: ['금리 동결', '물가 안정'] }],
      { referenceTime: REFERENCE },
    );
    expect(fetchTrends.mock.calls[0][0]).toEqual([]);
    expect(result.categories[0].issues[0]).toMatchObject({
      failureReason: 'noSearchTerm',
      searchTerms: [],
    });
  });

  it('이슈 하나를 검색어 묶음 하나로 요청한다', async () => {
    respond([ok('a', 10)]);
    await service.rank([issue('a', 'tech')], { referenceTime: REFERENCE });
    expect(fetchTrends.mock.calls[0][0]).toEqual([
      { groupName: 'a', keywords: ['a키워드 소식', 'a키워드', '소식'] },
    ]);
  });

  it('전체 순위는 카테고리를 합쳐 상위 15개이고 10위까지 top 이다', async () => {
    const issues = Array.from({ length: 20 }, (_, i) =>
      issue(`i${i}`, i % 2 ? 'tech' : 'economy'),
    );
    respond(issues.map((item, i) => ok(item.id, i + 1)));

    const result = await service.rank(issues, { referenceTime: REFERENCE });

    expect(result.overall).toHaveLength(15);
    expect(result.overall[0]).toMatchObject({
      id: 'i19',
      rank: 1,
      tier: 'top',
    });
    expect(result.overall[9].tier).toBe('top');
    expect(result.overall[10].tier).toBe('reserve');
    expect(result.categories.map((c) => c.category)).toEqual([
      'economy',
      'tech',
    ]);
  });

  it('testTerms 는 검색어별 일별 값과 spike 를 돌려준다', async () => {
    respond([ok('첫눈', 40, 1)]);
    const result = await service.testTerms(
      ['첫눈'],
      { ages: ['5'], days: 2 },
      REFERENCE,
    );
    expect(result.ages).toEqual(['5']);
    expect(result.period).toEqual({
      startDate: '2026-11-06',
      endDate: '2026-11-07',
    });
    expect(result.results[0]).toMatchObject({
      term: '첫눈',
      batch: 1,
      yesterdayRatio: 40,
      previousAverage: 10,
      spike: 4,
      flags: [],
    });
  });
});
