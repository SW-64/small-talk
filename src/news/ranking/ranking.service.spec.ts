import { Logger } from '@nestjs/common';
import { rankingConfig } from '../../config/ranking.config';
import {
  DatalabClient,
  DatalabGroup,
  DatalabGroupResult,
  DatalabRequest,
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

const ok = (groupName: string, ratio: number, anchorRatio = 10, batch = 1) =>
  ({
    groupName,
    batch,
    status: 'ok',
    ratio,
    anchorRatio,
  }) satisfies DatalabGroupResult;

const failed = (groupName: string) =>
  ({
    groupName,
    batch: 1,
    status: 'failed',
    reason: 'apiError',
  }) satisfies DatalabGroupResult;

describe('RankingService', () => {
  let fetchTrends: jest.Mock<
    Promise<DatalabGroupResult[]>,
    [DatalabGroup[], DatalabRequest]
  >;
  let service: RankingService;

  const respond = (results: DatalabGroupResult[]) =>
    fetchTrends.mockResolvedValue(results);

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    fetchTrends = jest.fn<
      Promise<DatalabGroupResult[]>,
      [DatalabGroup[], DatalabRequest]
    >();
    const config = rankingConfig();
    service = new RankingService(
      { fetchTrends } as unknown as DatalabClient,
      new SearchTermService(config),
      config,
    );
  });

  afterEach(() => jest.restoreAllMocks());

  it('어제 하루를 설정의 기준 키워드와 함께 조회한다', async () => {
    respond([ok('a', 10)]);
    const result = await service.rank([issue('a', 'tech')], {
      referenceTime: REFERENCE,
    });
    const [groups, request] = fetchTrends.mock.calls[0];
    expect(groups).toEqual([
      { groupName: 'a', keywords: ['a키워드 소식', 'a키워드', '소식'] },
    ]);
    expect(request.anchor).toBe('날씨');
    expect(request.period.startDate).toBe('2026-11-07');
    expect(request.period.endDate).toBe('2026-11-07');
    expect(result.date).toBe('2026-11-07');
  });

  it('점수는 어제 ratio ÷ 같은 요청의 기준 키워드 ratio 이다', async () => {
    // a 는 요청 안 절대값이 크지만 기준 대비로 환산하면 b 가 더 많이 검색됐다
    respond([ok('a', 100, 50, 1), ok('b', 40, 10, 2)]);
    const result = await service.rank(
      [issue('a', 'tech'), issue('b', 'tech')],
      { referenceTime: REFERENCE },
    );
    expect(result.issues.map((i) => [i.id, i.score, i.categoryRank])).toEqual([
      ['b', 4, 1],
      ['a', 2, 2],
    ]);
  });

  it('기준 키워드 값이 0 이면 점수 없이 anchorZero 로 뒤에 둔다', async () => {
    respond([ok('a', 30, 0), ok('b', 1, 10)]);
    const result = await service.rank(
      [issue('a', 'tech'), issue('b', 'tech')],
      { referenceTime: REFERENCE },
    );
    expect(result.issues.map((i) => i.id)).toEqual(['b', 'a']);
    expect(result.issues[1]).toMatchObject({
      score: null,
      yesterdayRatio: 30,
      anchorRatio: 0,
      failureReason: 'anchorZero',
    });
  });

  it('호출 실패 이슈는 점수 없이 뒤에 언론사 수 순으로 두고 집계한다', async () => {
    respond([failed('a'), ok('b', 1), failed('c')]);
    const result = await service.rank(
      [issue('a', 'tech', 3), issue('b', 'tech', 2), issue('c', 'tech', 8)],
      { referenceTime: REFERENCE },
    );
    expect(result.issues.map((i) => i.id)).toEqual(['b', 'c', 'a']);
    expect(result.issues[1]).toMatchObject({
      score: null,
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
    expect(result.issues[0]).toMatchObject({
      failureReason: 'noSearchTerm',
      searchTerms: [],
    });
  });

  it('카테고리 4위까지 카드 이슈이고 랭킹은 그 안에서 15개까지다', async () => {
    const issues = Array.from({ length: 30 }, (_, i) =>
      issue(
        `i${i}`,
        ['economy', 'tech', 'culture', 'society', 'environment'][i % 5],
      ),
    );
    respond(issues.map((item, i) => ok(item.id, i + 1)));

    const result = await service.rank(issues, { referenceTime: REFERENCE });

    const cards = result.issues.filter((i) => i.categoryRank !== null);
    expect(cards).toHaveLength(20);
    const ranked = result.issues.filter((i) => i.overallRank !== null);
    expect(ranked).toHaveLength(15);
    expect(ranked.every((i) => i.categoryRank !== null)).toBe(true);
    expect(result.issues.find((i) => i.overallRank === 1)?.id).toBe('i29');
  });

  it('testTerms 는 기준 키워드를 바꿔 검색어별 점수를 돌려준다', async () => {
    respond([ok('첫눈', 40, 20)]);
    const result = await service.testTerms(
      ['첫눈'],
      { ages: ['5'], anchor: '로또' },
      REFERENCE,
    );
    expect(fetchTrends.mock.calls[0][1].anchor).toBe('로또');
    expect(result).toMatchObject({
      date: '2026-11-07',
      ages: ['5'],
      anchorKeyword: '로또',
    });
    expect(result.results[0]).toMatchObject({
      term: '첫눈',
      batch: 1,
      yesterdayRatio: 40,
      anchorRatio: 20,
      score: 2,
    });
  });
});
