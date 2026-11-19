import { computeDatalabPeriod, fillMissingDates } from './datalab-period';

const kst = (iso: string) => new Date(`${iso}+09:00`);

describe('computeDatalabPeriod', () => {
  it('KST 어제를 끝으로 8일을 만든다', () => {
    const period = computeDatalabPeriod(kst('2026-11-08T12:00:00'), 8);
    expect(period.startDate).toBe('2026-10-31');
    expect(period.endDate).toBe('2026-11-07');
    expect(period.dates).toHaveLength(8);
    expect(period.dates[1]).toBe('2026-11-01');
  });

  it('UTC 로는 전날이어도 KST 날짜를 기준으로 한다', () => {
    const period = computeDatalabPeriod(kst('2026-11-08T00:30:00'), 8);
    expect(period.endDate).toBe('2026-11-07');
  });

  it('KST 자정 직전은 그날을 오늘로 본다', () => {
    const period = computeDatalabPeriod(kst('2026-11-07T23:59:00'), 8);
    expect(period.endDate).toBe('2026-11-06');
  });

  it('월·연 경계를 넘는다', () => {
    const period = computeDatalabPeriod(kst('2026-01-02T12:00:00'), 8);
    expect(period.startDate).toBe('2025-12-25');
    expect(period.endDate).toBe('2026-01-01');
  });
});

describe('fillMissingDates', () => {
  const dates = ['2026-11-05', '2026-11-06', '2026-11-07'];

  it('빠진 날짜를 0 으로 채운다', () => {
    expect(
      fillMissingDates([{ period: '2026-11-06', ratio: 12.5 }], dates),
    ).toEqual([
      { period: '2026-11-05', ratio: 0 },
      { period: '2026-11-06', ratio: 12.5 },
      { period: '2026-11-07', ratio: 0 },
    ]);
  });

  it('데이터가 전혀 없으면 모두 0 이다', () => {
    expect(fillMissingDates([], dates).map((d) => d.ratio)).toEqual([0, 0, 0]);
  });
});
