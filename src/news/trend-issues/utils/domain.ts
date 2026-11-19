const NAVER_NEWS_HOSTS = [
  'n.news.naver.com',
  'm.news.naver.com',
  'news.naver.com',
];

// co.kr, or.kr 처럼 2단계로 된 공용 접미사의 두 번째 라벨
const SECOND_LEVEL_LABELS = new Set([
  'co',
  'or',
  'go',
  'ne',
  're',
  'pe',
  'ac',
  'com',
  'net',
  'org',
  'gov',
  'edu',
]);

/**
 * 언론사 키 추출
 * - 네이버 뉴스 링크: 경로(/article/{번호}/..., /mnews/article/{번호}/...) 또는 oid 쿼리의
 *   언론사 번호로 `naver:{번호}` — 네이버 링크 기사들이 한 언론사로 합쳐지지 않게
 * - 그 외: 앞쪽 서브도메인(www., m., news., biz. 등)을 제거한 핵심 도메인
 */
export function extractPublisherKey(
  rawUrl: string,
  prefixes: string[],
): string {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return rawUrl.trim().toLowerCase();
  }

  const host = url.hostname.toLowerCase();
  if (NAVER_NEWS_HOSTS.includes(host)) {
    const oid = oidFromUrl(url);
    return oid ? `naver:${oid}` : 'naver.com';
  }

  return extractCoreDomain(host, prefixes);
}

function oidFromUrl(url: URL): string | null {
  return (
    /^\/(?:mnews\/)?article\/(\d+)(?:\/|$)/.exec(url.pathname)?.[1] ??
    url.searchParams.get('oid')
  );
}

// 네이버 뉴스 링크의 언론사 번호. 네이버 링크가 아니거나 번호가 없으면 null
export function extractNaverOid(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl);
    return NAVER_NEWS_HOSTS.includes(url.hostname.toLowerCase())
      ? oidFromUrl(url)
      : null;
  } catch {
    return null;
  }
}

export interface PublisherOptions {
  domainPrefixes: string[];
  naverOidToDomain: ReadonlyMap<string, string>;
}

/**
 * 기사의 언론사 키 결정
 * - link(또는 url)가 네이버 뉴스면 언론사 번호를 쓴다. 주요 언론사 번호는 그 도메인으로 바꿔
 *   같은 언론사가 도메인과 네이버 번호로 이중 집계되지 않게 한다
 * - 그 외에는 url 의 핵심 도메인
 */
export function resolvePublisher(
  url: string,
  link: string,
  { domainPrefixes, naverOidToDomain }: PublisherOptions,
): string {
  const oid = extractNaverOid(link) ?? extractNaverOid(url);
  if (oid) return naverOidToDomain.get(oid) ?? `naver:${oid}`;
  return extractPublisherKey(url, domainPrefixes);
}

export function extractCoreDomain(host: string, prefixes: string[]): string {
  const labels = host.toLowerCase().replace(/\.$/, '').split('.');
  const tld = labels[labels.length - 1] ?? '';
  const second = labels[labels.length - 2] ?? '';
  const minLabels = tld.length === 2 && SECOND_LEVEL_LABELS.has(second) ? 3 : 2;

  while (labels.length > minLabels && prefixes.includes(labels[0])) {
    labels.shift();
  }
  return labels.join('.');
}
