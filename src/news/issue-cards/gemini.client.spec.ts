import { parseErrorBody } from './gemini.client';

describe('parseErrorBody', () => {
  it('429 응답에서 첫 줄 메시지와 retryDelay 를 뽑는다', () => {
    const body = JSON.stringify({
      error: {
        code: 429,
        message: 'You exceeded your current quota.\n* Quota exceeded ...',
        details: [
          { '@type': 'type.googleapis.com/google.rpc.Help' },
          {
            '@type': 'type.googleapis.com/google.rpc.RetryInfo',
            retryDelay: '55s',
          },
        ],
      },
    });
    expect(parseErrorBody(body)).toEqual({
      message: 'You exceeded your current quota.',
      retryAfterMs: 55000,
    });
  });

  it('retryDelay 가 없으면 대기 시간 없이 메시지만', () => {
    const body = JSON.stringify({ error: { message: 'high demand' } });
    expect(parseErrorBody(body)).toEqual({
      message: 'high demand',
      retryAfterMs: undefined,
    });
  });

  it('JSON 이 아니면 본문 앞부분을 그대로', () => {
    expect(parseErrorBody('Bad Gateway')).toEqual({ message: 'Bad Gateway' });
  });
});
