export interface UrlNormalizeOptions {
  trackingParams: string[];
  trackingParamPrefixes: string[];
}

/**
 * 알려진 추적용 파라미터만 제거해 URL 정규화 (idxno 등 기사 식별 쿼리는 유지)
 * - host 소문자, #hash 제거, 경로 끝 / 제거
 * - 파싱할 수 없는 값은 trim 한 원문 그대로 반환
 */
export function normalizeUrl(
  raw: string,
  { trackingParams, trackingParamPrefixes }: UrlNormalizeOptions,
): string {
  const value = raw.trim();
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return value;
  }

  url.hash = '';
  for (const name of [...url.searchParams.keys()]) {
    const lower = name.toLowerCase();
    if (
      trackingParams.includes(lower) ||
      trackingParamPrefixes.some((prefix) => lower.startsWith(prefix))
    ) {
      url.searchParams.delete(name);
    }
  }
  if (url.pathname.length > 1 && url.pathname.endsWith('/')) {
    url.pathname = url.pathname.replace(/\/+$/, '');
  }

  // URL 은 host 를 자동으로 소문자화함
  return url.toString();
}
