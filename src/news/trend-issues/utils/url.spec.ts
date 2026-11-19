import { normalizeUrl } from './url';

const OPTIONS = {
  trackingParams: ['did', 'fbclid', 'gclid'],
  trackingParamPrefixes: ['utm_'],
};
const norm = (url: string) => normalizeUrl(url, OPTIONS);

describe('normalizeUrl', () => {
  it('추적용 파라미터(did, utm_*)만 제거하고 기사 번호 쿼리는 유지한다', () => {
    expect(
      norm(
        'https://www.example.co.kr/news/articleView.html?idxno=12345&did=NA&utm_source=naver',
      ),
    ).toBe('https://www.example.co.kr/news/articleView.html?idxno=12345');
  });

  it('추적 파라미터가 없으면 쿼리를 그대로 둔다', () => {
    expect(norm('https://www.example.com/view?aid=1&oid=2')).toBe(
      'https://www.example.com/view?aid=1&oid=2',
    );
  });

  it('hash, 경로 끝 / 를 제거하고 host 를 소문자로', () => {
    expect(norm('https://WWW.Example.com/a/b/#top')).toBe(
      'https://www.example.com/a/b',
    );
  });

  it('추적 파라미터만 있었다면 ? 까지 사라진다', () => {
    expect(norm('https://www.example.com/a?did=NA')).toBe(
      'https://www.example.com/a',
    );
  });

  it('파싱할 수 없으면 원문을 돌려준다', () => {
    expect(norm(' not-a-url ')).toBe('not-a-url');
  });
});
