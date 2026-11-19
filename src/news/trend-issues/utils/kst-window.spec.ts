import { computeKstWindow, computeLast24hWindow, toKstIso } from './kst-window';

const kst = (iso: string) => new Date(`${iso}+09:00`);

describe('computeKstWindow', () => {
  it('06:00 이후 요청이면 전날 06:00 ~ 당일 06:00', () => {
    const w = computeKstWindow(kst('2026-10-28T23:00:00'), 6);
    expect(toKstIso(w.start)).toBe('2026-10-27T06:00:00+09:00');
    expect(toKstIso(w.end)).toBe('2026-10-28T06:00:00+09:00');
  });

  it('정각 06:00 요청이면 그 시각이 끝', () => {
    const w = computeKstWindow(kst('2026-10-28T06:00:00'), 6);
    expect(toKstIso(w.end)).toBe('2026-10-28T06:00:00+09:00');
  });

  it('06:00 이전 요청이면 가장 최근에 끝난 기간(그저께 06:00 ~ 어제 06:00)', () => {
    const w = computeKstWindow(kst('2026-10-28T05:59:00'), 6);
    expect(toKstIso(w.start)).toBe('2026-10-26T06:00:00+09:00');
    expect(toKstIso(w.end)).toBe('2026-10-27T06:00:00+09:00');
  });

  it('date 를 지정하면 그 날짜 기준 (월 경계 포함)', () => {
    const w = computeKstWindow(kst('2026-10-28T12:00:00'), 6, '2026-11-01');
    expect(toKstIso(w.start)).toBe('2026-10-31T06:00:00+09:00');
    expect(toKstIso(w.end)).toBe('2026-11-01T06:00:00+09:00');
  });
});

describe('computeLast24hWindow', () => {
  it('실행 시각 기준 최근 24시간', () => {
    const w = computeLast24hWindow(kst('2026-10-28T13:30:00'));
    expect(toKstIso(w.start)).toBe('2026-10-27T13:30:00+09:00');
    expect(toKstIso(w.end)).toBe('2026-10-28T13:30:00+09:00');
  });
});
