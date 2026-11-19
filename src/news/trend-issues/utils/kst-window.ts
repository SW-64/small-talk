import { TimeWindow } from '../trend-issues.types';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const KST_OFFSET_MS = 9 * HOUR_MS;

/**
 * 수집 기간 [전날 startHour시, 당일 startHour시) (KST)
 * - date(YYYY-MM-DD, KST 기준 "당일")를 주면 그 날짜 기준
 * - 없으면 now 기준으로 가장 최근에 끝난 startHour시를 끝으로 하는 24시간
 */
export function computeKstWindow(
  now: Date,
  startHourKst: number,
  date?: string,
): TimeWindow {
  let end: number;
  if (date) {
    const [y, m, d] = date.split('-').map(Number);
    end = Date.UTC(y, m - 1, d, startHourKst) - KST_OFFSET_MS;
  } else {
    const kstNow = new Date(now.getTime() + KST_OFFSET_MS);
    end =
      Date.UTC(
        kstNow.getUTCFullYear(),
        kstNow.getUTCMonth(),
        kstNow.getUTCDate(),
        startHourKst,
      ) - KST_OFFSET_MS;
    if (end > now.getTime()) end -= DAY_MS;
  }
  return { start: new Date(end - DAY_MS), end: new Date(end) };
}

// 실행 시각 기준 최근 24시간
export function computeLast24hWindow(now: Date): TimeWindow {
  return { start: new Date(now.getTime() - DAY_MS), end: new Date(now) };
}

// 2026-10-28T06:00:00+09:00 형식
export function toKstIso(date: Date): string {
  const kst = new Date(date.getTime() + KST_OFFSET_MS);
  return `${kst.toISOString().slice(0, 19)}+09:00`;
}
