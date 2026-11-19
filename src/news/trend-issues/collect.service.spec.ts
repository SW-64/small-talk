import { Logger } from '@nestjs/common';
import { trendIssuesConfig } from '../../config/trend-issues.config';
import { NaverNewsItem, NaverNewsResponse } from '../dto/naver-news.types';
import {
  NaverApiError,
  NaverBudgetExceededError,
  NaverNewsClient,
  NaverNewsRequestOptions,
  NaverNewsSearchParams,
} from '../naver/naver-news.client';
import { CallBudget } from '../common/call-budget';
import { CollectService } from './collect.service';
import { KeywordTarget } from './trend-issues.types';

const WINDOW = {
  start: new Date('2026-10-27T06:00:00+09:00'),
  end: new Date('2026-10-28T06:00:00+09:00'),
};

const item = (kstIso: string, id: string): NaverNewsItem => ({
  title: id,
  originallink: `https://a.com/${id}`,
  link: '',
  description: '',
  pubDate: new Date(`${kstIso}+09:00`).toUTCString(),
});

const response = (items: NaverNewsItem[]): NaverNewsResponse => ({
  lastBuildDate: '',
  total: 1000,
  start: 1,
  display: items.length,
  items,
});

const target = (keyword: string, category = 'economy'): KeywordTarget => ({
  category,
  keyword,
  seasonal: false,
});

const FULL_PAGE = response([
  item('2026-10-28T01:00:00', 'a'),
  item('2026-10-28T00:00:00', 'b'),
]);

describe('CollectService', () => {
  let search: jest.Mock<
    Promise<NaverNewsResponse>,
    [NaverNewsSearchParams, NaverNewsRequestOptions?]
  >;
  let warn: jest.SpyInstance;

  const createService = (concurrency = 3) => {
    const config = trendIssuesConfig();
    return new CollectService({ search } as unknown as NaverNewsClient, {
      ...config,
      fetch: { ...config.fetch, display: 2, maxStart: 5, concurrency },
    });
  };

  // 실제 클라이언트처럼 요청 직전에 예산을 확인하는 search
  const searchWithBudget = (
    _params: NaverNewsSearchParams,
    options?: NaverNewsRequestOptions,
  ) =>
    options?.acquire && !options.acquire()
      ? Promise.reject(new NaverBudgetExceededError())
      : Promise.resolve(FULL_PAGE);

  beforeEach(() => {
    search = jest.fn<
      Promise<NaverNewsResponse>,
      [NaverNewsSearchParams, NaverNewsRequestOptions?]
    >();
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => jest.restoreAllMocks());

  const budget = () => new CallBudget(100);

  it('sort=date 로 페이지를 넘기고, 범위보다 오래된 기사가 나오면 중단한다', async () => {
    search
      .mockResolvedValueOnce(
        response([
          item('2026-10-28T07:00:00', 'newer'),
          item('2026-10-28T05:00:00', 'in1'),
        ]),
      )
      .mockResolvedValueOnce(
        response([
          item('2026-10-27T06:00:00', 'in2'),
          item('2026-10-27T05:59:59', 'older'),
        ]),
      );

    const result = await createService().collectKeyword(
      target('기준금리'),
      WINDOW,
      budget(),
    );

    expect(search).toHaveBeenCalledTimes(2);
    expect(
      search.mock.calls.map(([p]) => [p.start, p.display, p.sort]),
    ).toEqual([
      [1, 2, 'date'],
      [3, 2, 'date'],
    ]);
    expect(result.pages).toBe(2);
    expect(result.articles.map((a) => a.item.title)).toEqual(['in1', 'in2']);
    expect(result.limitReached).toBe(false);
  });

  it('수집한 기사에 카테고리와 키워드를 기록한다', async () => {
    search.mockResolvedValueOnce(
      response([item('2026-10-28T01:00:00', 'only')]),
    );
    const result = await createService().collectKeyword(
      target('반도체', 'tech'),
      WINDOW,
      budget(),
    );
    expect(result.articles[0]).toMatchObject({
      category: 'tech',
      keyword: '반도체',
    });
  });

  it('결과가 display 보다 적게 오면 마지막 페이지로 보고 끝낸다', async () => {
    search.mockResolvedValueOnce(
      response([item('2026-10-28T01:00:00', 'only')]),
    );
    const result = await createService().collectKeyword(
      target('환율'),
      WINDOW,
      budget(),
    );
    expect(search).toHaveBeenCalledTimes(1);
    expect(result.articles).toHaveLength(1);
  });

  it('start 한도까지 모두 범위 안이면 경고한다', async () => {
    search.mockResolvedValue(FULL_PAGE);
    const result = await createService().collectKeyword(
      target('부동산'),
      WINDOW,
      budget(),
    );

    expect(search.mock.calls.map(([p]) => p.start)).toEqual([1, 3, 5]);
    expect(result.limitReached).toBe(true);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('한도 도달'));
  });

  it('pubDate 를 파싱할 수 없는 기사는 제외한다', async () => {
    search.mockResolvedValueOnce(
      response([{ ...item('2026-10-28T01:00:00', 'bad'), pubDate: 'invalid' }]),
    );
    const result = await createService().collectKeyword(
      target('환율'),
      WINDOW,
      budget(),
    );
    expect(result.articles).toHaveLength(0);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('파싱 실패 1건'));
  });

  it('재시도 후에도 실패하면 그 키워드만 건너뛰고 결과는 입력 순서를 유지한다', async () => {
    search.mockImplementation(({ query }: { query: string }) =>
      query === '환율'
        ? Promise.reject(new NaverApiError('응답 오류 500', 500))
        : Promise.resolve(response([item('2026-10-28T01:00:00', query)])),
    );

    const results = await createService().collectAll(
      [target('기준금리'), target('환율'), target('부동산')],
      WINDOW,
      budget(),
    );

    expect(
      results.map((r) => [r.keyword, r.failed, r.articles.length]),
    ).toEqual([
      ['기준금리', false, 1],
      ['환율', true, 0],
      ['부동산', false, 1],
    ]);
  });

  it('재시도 옵션을 클라이언트에 넘긴다', async () => {
    search.mockResolvedValueOnce(response([]));
    await createService().collectKeyword(target('환율'), WINDOW, budget());
    expect(search.mock.calls[0][1]).toMatchObject({
      maxRetries: 3,
      retryBaseMs: 500,
      timeoutMs: 5000,
    });
  });

  describe('호출 예산', () => {
    it('한도에 닿으면 진행 중 키워드는 멈추고 남은 키워드는 건너뛰며 한 번 경고한다', async () => {
      search.mockImplementation(searchWithBudget);
      const callBudget = new CallBudget(4);

      const results = await createService(1).collectAll(
        [target('가'), target('나'), target('다')],
        WINDOW,
        callBudget,
      );

      expect(callBudget.used).toBe(4);
      expect(
        results.map((r) => [r.keyword, r.calls, r.budgetStopped, r.skipped]),
      ).toEqual([
        ['가', 3, false, false],
        ['나', 1, true, false],
        ['다', 0, false, true],
      ]);
      expect(results[1].articles).toHaveLength(2);

      const budgetWarnings = (warn.mock.calls as [string][])
        .map(([message]) => message)
        .filter((message) => message.includes('호출 예산'));
      expect(budgetWarnings).toHaveLength(1);
      expect(budgetWarnings[0]).toContain('중단: 나');
      expect(budgetWarnings[0]).toContain('건너뜀: 다');
    });

    it('재시도로 발생한 요청도 키워드 호출 수에 포함한다', async () => {
      search.mockImplementationOnce((_params, options) => {
        options?.acquire?.(); // 실패한 첫 시도
        options?.acquire?.(); // 재시도
        return Promise.resolve(response([]));
      });
      const callBudget = new CallBudget(10);

      const result = await createService().collectKeyword(
        target('환율'),
        WINDOW,
        callBudget,
      );

      expect(result.calls).toBe(2);
      expect(result.pages).toBe(1);
      expect(callBudget.used).toBe(2);
    });

    it('병렬 수집에서도 한도를 넘지 않고 동시 실행 수를 지킨다', async () => {
      let inFlight = 0;
      let maxInFlight = 0;
      search.mockImplementation(async (params, options) => {
        inFlight++;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 1));
        inFlight--;
        return searchWithBudget(params, options);
      });
      const callBudget = new CallBudget(5);

      await createService(2).collectAll(
        ['가', '나', '다', '라', '마'].map((k) => target(k)),
        WINDOW,
        callBudget,
      );

      expect(callBudget.used).toBe(5);
      expect(maxInFlight).toBe(2);
    });
  });
});
