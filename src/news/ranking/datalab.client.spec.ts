import { Logger } from '@nestjs/common';
import { rankingConfig } from '../../config/ranking.config';
import { CallBudget } from '../common/call-budget';
import { ANCHOR_GROUP, DatalabClient, DatalabGroup } from './datalab.client';
import { computeDatalabPeriod } from './datalab-period';

const period = computeDatalabPeriod(new Date('2026-11-08T12:00:00+09:00'), 1);
const request = { period, ages: ['4', '5', '6'], anchor: '날씨' };
const NAVER = {
  keyId: 'id',
  key: 'key',
  newsUrl: '',
  datalabUrl: 'https://example.test/trend',
};

interface RequestBody {
  startDate: string;
  endDate: string;
  timeUnit: string;
  ages: string[];
  keywordGroups: DatalabGroup[];
}

const groups = (count: number): DatalabGroup[] =>
  Array.from({ length: count }, (_, i) => ({
    groupName: `issue-${i + 1}`,
    keywords: [`검색어${i + 1}`],
  }));

const status = (code: number) => new Response('{}', { status: code });

// 요청받은 그룹마다 어제 값(기준 키워드 25, 나머지 50)을 돌려주는 정상 응답
const echo = (_url: string, init: RequestInit) => {
  const body = JSON.parse(init.body as string) as RequestBody;
  return Promise.resolve(
    new Response(
      JSON.stringify({
        results: body.keywordGroups.map(({ groupName }) => ({
          title: groupName,
          data: [
            {
              period: period.endDate,
              ratio: groupName === ANCHOR_GROUP ? 25 : 50,
            },
          ],
        })),
      }),
      { status: 200 },
    ),
  );
};

describe('DatalabClient', () => {
  let fetchMock: jest.SpyInstance<Promise<Response>, [string, RequestInit]>;
  let warn: jest.SpyInstance;
  let client: DatalabClient;

  const bodies = () =>
    fetchMock.mock.calls.map(
      ([, init]) => JSON.parse(init.body as string) as RequestBody,
    );

  beforeEach(() => {
    const config = rankingConfig();
    client = new DatalabClient(NAVER, {
      ...config,
      datalab: { ...config.datalab, retryBaseMs: 1 },
    });
    fetchMock = jest.spyOn(global, 'fetch') as unknown as typeof fetchMock;
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => jest.restoreAllMocks());

  it('이슈를 4개씩 묶고 요청마다 기준 키워드를 넣는다', async () => {
    fetchMock.mockImplementation(echo);
    const budget = new CallBudget(50);

    const results = await client.fetchTrends(groups(10), request, budget);

    expect(bodies().map((b) => b.keywordGroups.length)).toEqual([5, 5, 3]);
    expect(
      bodies().every((b) =>
        b.keywordGroups.some(
          (g) => g.groupName === ANCHOR_GROUP && g.keywords[0] === '날씨',
        ),
      ),
    ).toBe(true);
    expect(budget.used).toBe(3);
    expect(results.map((r) => r.batch)).toEqual([1, 1, 1, 1, 2, 2, 2, 2, 3, 3]);
  });

  it('이슈와 기준 키워드의 어제 값을 돌려준다', async () => {
    fetchMock.mockImplementation(echo);
    const [result] = await client.fetchTrends(
      groups(1),
      request,
      new CallBudget(50),
    );
    expect(result).toEqual({
      groupName: 'issue-1',
      batch: 1,
      status: 'ok',
      ratio: 50,
      anchorRatio: 25,
    });
  });

  it('요청 본문과 헤더를 명세대로 보낸다', async () => {
    fetchMock.mockImplementation(echo);
    await client.fetchTrends(groups(1), request, new CallBudget(50));

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(NAVER.datalabUrl);
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({
      'X-NCP-APIGW-API-KEY-ID': 'id',
      'X-NCP-APIGW-API-KEY': 'key',
      'Content-Type': 'application/json',
    });
    expect(bodies()[0]).toEqual({
      startDate: '2026-11-07',
      endDate: '2026-11-07',
      timeUnit: 'date',
      keywordGroups: [
        ...groups(1),
        { groupName: ANCHOR_GROUP, keywords: ['날씨'] },
      ],
      ages: ['4', '5', '6'],
    });
  });

  it('응답에서 어제 값이 빠진 그룹은 0 으로 본다', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          results: [
            { title: 'issue-1', data: [] },
            {
              title: ANCHOR_GROUP,
              data: [{ period: period.endDate, ratio: 30 }],
            },
          ],
        }),
      ),
    );
    const [result] = await client.fetchTrends(
      groups(1),
      request,
      new CallBudget(50),
    );
    expect(result).toMatchObject({ status: 'ok', ratio: 0, anchorRatio: 30 });
  });

  it('응답에 기준 키워드가 없으면 그 요청의 이슈는 apiError 이다', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          results: [
            { title: 'issue-1', data: [{ period: period.endDate, ratio: 9 }] },
          ],
        }),
      ),
    );
    const [result] = await client.fetchTrends(
      groups(1),
      request,
      new CallBudget(50),
    );
    expect(result).toMatchObject({ status: 'failed', reason: 'apiError' });
  });

  it('429·5xx 는 재시도하며 재시도도 호출 수에 포함한다', async () => {
    fetchMock
      .mockResolvedValueOnce(status(429))
      .mockResolvedValueOnce(status(503))
      .mockImplementation(echo);
    const budget = new CallBudget(50);

    const [result] = await client.fetchTrends(groups(1), request, budget);

    expect(result.status).toBe('ok');
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(budget.used).toBe(3);
  });

  it('최대 3회 재시도 후에도 실패하면 그 요청의 이슈만 apiError 이다', async () => {
    fetchMock
      .mockResolvedValueOnce(status(500))
      .mockResolvedValueOnce(status(500))
      .mockResolvedValueOnce(status(500))
      .mockResolvedValueOnce(status(500))
      .mockImplementation(echo);

    const results = await client.fetchTrends(
      groups(5),
      request,
      new CallBudget(50),
    );

    expect(fetchMock).toHaveBeenCalledTimes(5);
    expect(results.slice(0, 4).map((r) => r.status)).toEqual(
      Array(4).fill('failed'),
    );
    expect(results[0]).toMatchObject({ reason: 'apiError' });
    expect(results[4].status).toBe('ok');
  });

  it('그 밖의 4xx 는 재시도하지 않는다', async () => {
    fetchMock.mockResolvedValueOnce(status(400));
    const [result] = await client.fetchTrends(
      groups(1),
      request,
      new CallBudget(50),
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ status: 'failed', reason: 'apiError' });
  });

  it('예산을 넘으면 남은 이슈를 건너뛰고 한 번 경고한다', async () => {
    fetchMock.mockImplementation(echo);
    const budget = new CallBudget(1);

    const results = await client.fetchTrends(groups(12), request, budget);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(results.slice(4).every((r) => r.status === 'failed')).toBe(true);
    expect(results[4]).toMatchObject({ reason: 'budgetExceeded' });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('이슈 8개'));
  });

  it('어제 데이터가 어느 그룹에도 없으면 경고한다', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ results: [{ title: 'issue-1', data: [] }] }),
      ),
    );
    await client.fetchTrends(groups(1), request, new CallBudget(50));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('미반영'));
  });
});
