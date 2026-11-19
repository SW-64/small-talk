import { DailyRatio } from './ranking.types';

const DAY_MS = 24 * 60 * 60 * 1000;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

export interface DatalabPeriod {
  startDate: string;
  endDate: string;
  dates: string[]; // startDate ~ endDate 오름차순
}

// reference 시각의 KST 날짜 기준으로 "어제"를 끝으로 하는 days 일
export function computeDatalabPeriod(
  reference: Date,
  days: number,
): DatalabPeriod {
  const kst = new Date(reference.getTime() + KST_OFFSET_MS);
  const today = Date.UTC(
    kst.getUTCFullYear(),
    kst.getUTCMonth(),
    kst.getUTCDate(),
  );
  const dates = Array.from({ length: days }, (_, i) =>
    new Date(today - (days - i) * DAY_MS).toISOString().slice(0, 10),
  );
  return { startDate: dates[0], endDate: dates[days - 1], dates };
}

// 검색이 거의 없는 날은 응답에서 빠지므로 ratio 0 으로 채운다
export function fillMissingDates(
  data: DailyRatio[],
  dates: string[],
): DailyRatio[] {
  const byPeriod = new Map(data.map((d) => [d.period, d.ratio]));
  return dates.map((period) => ({
    period,
    ratio: byPeriod.get(period) ?? 0,
  }));
}
