import { computeSpike } from './spike';

const OPTIONS = { zeroBaselineRatio: 1, minYesterdayRatio: 5 };

describe('computeSpike', () => {
  it('어제 ratio 를 이전 평균으로 나눈다', () => {
    const result = computeSpike([10, 10, 20, 20, 10, 10, 10, 60], OPTIONS);
    expect(result.yesterdayRatio).toBe(60);
    expect(result.previousAverage).toBeCloseTo(90 / 7);
    expect(result.spike).toBeCloseTo(60 / (90 / 7));
    expect(result.flags).toEqual([]);
  });

  it('이전 평균이 0 이면 설정값을 분모로 쓰고 new 를 표시한다', () => {
    const result = computeSpike([0, 0, 0, 0, 0, 0, 0, 40], {
      ...OPTIONS,
      zeroBaselineRatio: 2,
    });
    expect(result.previousAverage).toBe(0);
    expect(result.spike).toBe(20);
    expect(result.flags).toEqual(['new']);
  });

  it('어제 ratio 가 최솟값 미만이면 lowVolume 을 표시한다', () => {
    expect(computeSpike([2, 2, 4.9], OPTIONS).flags).toEqual(['lowVolume']);
    expect(computeSpike([2, 2, 5], OPTIONS).flags).toEqual([]);
  });

  it('new 와 lowVolume 은 함께 표시될 수 있다', () => {
    expect(computeSpike([0, 0, 3], OPTIONS).flags).toEqual([
      'new',
      'lowVolume',
    ]);
  });
});
