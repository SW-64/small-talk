const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

// Date → KST 기준 YYYY-MM-DD
export function toKstDate(date: Date): string {
  return new Date(date.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
}
