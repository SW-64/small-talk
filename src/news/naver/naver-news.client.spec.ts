import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  NaverApiError,
  NaverBudgetExceededError,
  NaverNewsClient,
} from './naver-news.client';

const PARAMS = { query: '환율', display: 100, start: 1, sort: 'date' as const };
const OPTIONS = { maxRetries: 3, retryBaseMs: 1, timeoutMs: 1000 };

const jsonResponse = (status: number, body: unknown = {}) =>
  new Response(JSON.stringify(body), { status });

describe('NaverNewsClient', () => {
  let fetchMock: jest.SpyInstance;
  let client: NaverNewsClient;

  beforeEach(() => {
    const values: Record<string, string> = {
      'naver.keyId': 'id',
      'naver.key': 'key',
      'naver.newsUrl': 'https://example.test/news',
    };
    client = new NaverNewsClient({
      get: (k: string) => values[k],
    } as unknown as ConfigService);
    fetchMock = jest.spyOn(global, 'fetch');
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });

  afterEach(() => jest.restoreAllMocks());

  it('인증 헤더와 쿼리를 붙여 호출한다', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { items: [] }));
    await client.search(PARAMS, OPTIONS);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      'https://example.test/news?query=%ED%99%98%EC%9C%A8&display=100&start=1&sort=date',
    );
    expect(init.headers).toEqual({
      'X-NCP-APIGW-API-KEY-ID': 'id',
      'X-NCP-APIGW-API-KEY': 'key',
    });
  });

  it('429/5xx 는 재시도해서 성공하면 결과를 돌려준다', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(429))
      .mockResolvedValueOnce(jsonResponse(503))
      .mockResolvedValueOnce(jsonResponse(200, { items: [{ title: 'ok' }] }));
    const body = await client.search(PARAMS, OPTIONS);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(body.items).toHaveLength(1);
  });

  it('최대 3회 재시도 후에도 실패하면 에러를 던진다 (총 4회 호출)', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse(500)));
    await expect(client.search(PARAMS, OPTIONS)).rejects.toBeInstanceOf(
      NaverApiError,
    );
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('네트워크 오류도 재시도한다', async () => {
    fetchMock
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce(jsonResponse(200, { items: [] }));
    await client.search(PARAMS, OPTIONS);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('그 밖의 4xx 는 재시도하지 않는다', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(401));
    await expect(client.search(PARAMS, OPTIONS)).rejects.toMatchObject({
      status: 401,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('acquire 는 재시도를 포함해 실제 요청마다 호출된다', async () => {
    const acquire = jest.fn(() => true);
    fetchMock
      .mockResolvedValueOnce(jsonResponse(500))
      .mockResolvedValueOnce(jsonResponse(200, { items: [] }));
    await client.search(PARAMS, { ...OPTIONS, acquire });
    expect(acquire).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('재시도 중 예산이 없으면 더 요청하지 않고 예산 오류를 던진다', async () => {
    const acquire = jest
      .fn<boolean, []>()
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(false);
    fetchMock.mockResolvedValueOnce(jsonResponse(500));
    await expect(
      client.search(PARAMS, { ...OPTIONS, acquire }),
    ).rejects.toBeInstanceOf(NaverBudgetExceededError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
