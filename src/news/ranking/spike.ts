import { RankingFlag } from './ranking.types';

export interface SpikeOptions {
  zeroBaselineRatio: number;
  minYesterdayRatio: number;
}

export interface SpikeResult {
  yesterdayRatio: number;
  previousAverage: number;
  spike: number;
  flags: RankingFlag[];
}

/**
 * 급상승도: 어제 ratio ÷ 이전 날들의 평균 ratio.
 * ratios 는 한 응답 안의 한 이슈 값(날짜 오름차순)이어야 하며 마지막이 어제다.
 */
export function computeSpike(
  ratios: number[],
  { zeroBaselineRatio, minYesterdayRatio }: SpikeOptions,
): SpikeResult {
  const yesterdayRatio = ratios[ratios.length - 1];
  const previous = ratios.slice(0, -1);
  const previousAverage =
    previous.reduce((sum, ratio) => sum + ratio, 0) / previous.length;

  const flags: RankingFlag[] = [];
  if (previousAverage === 0) flags.push('new');
  if (yesterdayRatio < minYesterdayRatio) flags.push('lowVolume');

  return {
    yesterdayRatio,
    previousAverage,
    spike:
      yesterdayRatio /
      (previousAverage === 0 ? zeroBaselineRatio : previousAverage),
    flags,
  };
}
