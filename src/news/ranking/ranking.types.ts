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

// anchorZero: 같은 요청의 기준 키워드 값이 0 이라 환산 불가
export type RankingFailureReason =
  'apiError' | 'budgetExceeded' | 'noSearchTerm' | 'anchorZero';

// 점수 = 이슈의 어제 ratio ÷ 같은 요청 안 기준 키워드의 어제 ratio
export interface ScoreFields {
  yesterdayRatio: number | null;
  anchorRatio: number | null;
  score: number | null;
  failureReason?: RankingFailureReason;
}

export interface RankedIssue extends ScoreFields {
  id: string;
  category: string;
  representativeTitle: string;
  publisherCount: number;
  searchTerms: SearchTerm[];
  categoryPosition: number; // 카테고리 안 정렬 순서 (후보 전체 기준, 1부터)
  categoryRank: number | null; // 1~cardsPerCategory 만. 1 = Today Pick, 나머지 = 예비
  overallRank: number | null; // 카드 이슈 안에서 1~overallTopN
}

export interface DatalabCallStats {
  used: number;
  limit: number;
  exhausted: boolean;
}

export interface RankingResult {
  date: string; // 조회한 "어제" (KST)
  ages: string[];
  anchorKeyword: string;
  calls: DatalabCallStats;
  candidates: { total: number; ranked: number; failed: number };
  // 카테고리 순서 → 카테고리 안 정렬 순서
  issues: RankedIssue[];
}

export interface DatalabTestResult {
  date: string;
  ages: string[];
  anchorKeyword: string;
  calls: DatalabCallStats;
  results: (ScoreFields & { term: string; batch: number })[];
}
