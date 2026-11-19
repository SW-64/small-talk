// 랭킹 입력: 수집 파이프라인 내부 타입에 의존하지 않는 이슈 목록
export interface RankingIssueInput {
  id: string;
  category: string;
  representativeTitle: string;
  publisherCount: number;
  titles: string[];
}

export interface SearchTerm {
  term: string;
  articleCount: number; // 이 표현이 등장한 제목 수
}

export interface DailyRatio {
  period: string; // yyyy-mm-dd
  ratio: number;
}

export type RankingFlag = 'new' | 'lowVolume' | 'rankingFailed';
export type RankingFailureReason =
  'apiError' | 'budgetExceeded' | 'noSearchTerm';

export interface SpikeFields {
  dailyRatios: DailyRatio[];
  yesterdayRatio: number | null;
  previousAverage: number | null;
  spike: number | null;
  flags: RankingFlag[];
  failureReason?: RankingFailureReason;
}

export interface RankedIssue extends SpikeFields {
  id: string;
  category: string;
  representativeTitle: string;
  publisherCount: number;
  searchTerms: SearchTerm[];
}

export interface CategoryRankedIssue extends RankedIssue {
  rank: number;
}

export interface OverallRankedIssue extends RankedIssue {
  rank: number;
  tier: 'top' | 'reserve';
}

export interface DatalabCallStats {
  used: number;
  limit: number;
  exhausted: boolean;
}

export interface RankingResult {
  period: { startDate: string; endDate: string };
  ages: string[];
  calls: DatalabCallStats;
  candidates: { total: number; ranked: number; failed: number };
  categories: { category: string; issues: CategoryRankedIssue[] }[];
  overall: OverallRankedIssue[];
}

export interface DatalabTestResult {
  period: { startDate: string; endDate: string };
  ages: string[];
  calls: DatalabCallStats;
  results: (SpikeFields & { term: string; batch: number })[];
}
