import { parsePubDate } from './pub-date';

describe('parsePubDate', () => {
  it('+0900 오프셋을 반영해 정확한 시각으로 파싱한다', () => {
    expect(parsePubDate('Wed, 28 Oct 2026 15:25:00 +0900')?.toISOString()).toBe(
      '2026-10-28T06:25:00.000Z',
    );
  });

  it('+0000, -0500 오프셋도 정확히 파싱한다', () => {
    expect(parsePubDate('Wed, 28 Oct 2026 15:25:00 +0000')?.toISOString()).toBe(
      '2026-10-28T15:25:00.000Z',
    );
    expect(parsePubDate('Wed, 28 Oct 2026 15:25:00 -0500')?.toISOString()).toBe(
      '2026-10-28T20:25:00.000Z',
    );
  });

  it('KST 06:00 경계 시각을 정확히 파싱한다', () => {
    expect(parsePubDate('Wed, 28 Oct 2026 06:00:00 +0900')?.getTime()).toBe(
      Date.UTC(2026, 9, 27, 21, 0, 0),
    );
    expect(parsePubDate('Wed, 28 Oct 2026 05:59:59 +0900')?.getTime()).toBe(
      Date.UTC(2026, 9, 27, 20, 59, 59),
    );
  });

  it('잘못된 값이면 null 을 반환한다', () => {
    expect(parsePubDate('')).toBeNull();
    expect(parsePubDate('   ')).toBeNull();
    expect(parsePubDate(undefined)).toBeNull();
    expect(parsePubDate(null)).toBeNull();
    expect(parsePubDate('not a date')).toBeNull();
    expect(parsePubDate('Wed, 32 Foo 2026 25:61:00 +0900')).toBeNull();
  });
});
