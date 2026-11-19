// NAVER pubDate(RFC 2822, 예: "Wed, 28 Oct 2026 15:25:00 +0900")를 기본 Date로 파싱. 잘못된 값이면 null
export function parsePubDate(value: string | null | undefined): Date | null {
  if (!value?.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
