import { NaverNewsItem } from '../dto/naver-news.types';
import { RankingResult } from '../ranking/ranking.types';

export interface TimeWindow {
  start: Date; // 포함
  end: Date; // 미포함
}

export type WindowType = 'previousDay' | 'last24h';
export type RankingMode = 'none' | 'datalab';

export interface TrendIssuesRunOptions {
  date?: string;
  categories?: string[];
  maxKeywordsPerCategory?: number;
  window?: WindowType;
  ranking?: RankingMode;
}

export interface KeywordTarget {
  category: string;
  keyword: string;
  seasonal: boolean;
}

// [1] 수집 결과: API 응답 그대로 + 파싱된 시각, 잡힌 카테고리·키워드
export interface RawArticle {
  item: NaverNewsItem;
  category: string;
  keyword: string;
  publishedAt: Date;
}

export interface KeywordCollectResult extends KeywordTarget {
  pages: number;
  calls: number; // 재시도를 포함한 실제 HTTP 요청 수
  articles: RawArticle[];
  failed: boolean;
  limitReached: boolean;
  skipped: boolean; // 예산 소진으로 시작하지 못함
  budgetStopped: boolean; // 수집 도중 예산 소진으로 멈춤
}

export interface ArticleSource {
  category: string;
  keyword: string;
}

// [2] 정리된 기사
export interface Article {
  title: string;
  description: string;
  url: string;
  publisher: string;
  publishedAt: Date;
  sources: ArticleSource[];
}

export interface WordMatch {
  word: string;
  articleCount: number;
}

// [4] 세기 결과
export interface IssueCluster {
  representativeTitle: string;
  category: string;
  articleCount: number;
  publisherCount: number;
  majorPublisherCount: number;
  publishers: string[];
  majorPublishers: string[];
  keywords: string[];
  excluded: boolean;
  excludeReasons: WordMatch[];
  marketReport: boolean;
  marketReportWords: WordMatch[];
  articles: Article[];
}

export interface KeywordStats {
  category: string;
  keyword: string;
  seasonal: boolean;
  calls: number;
  pages: number;
  articlesInWindow: number;
  limitReached: boolean;
  failed: boolean;
  skipped: boolean;
  budgetStopped: boolean;
  topIssues: number; // 이 키워드로 잡힌 기사가 포함된 상위 이슈 수
  soloTopIssues: number; // 이 키워드로만 잡힌 기사들로 구성된 상위 이슈 수
}

export interface TrendIssue {
  rank: number;
  representativeTitle: string;
  publisherCount: number;
  majorPublisherCount: number;
  articleCount: number;
  keywords: string[];
  publishers: string[];
  majorPublishers: string[];
  excluded: boolean;
  excludeReasons: WordMatch[];
  marketReport: boolean;
  marketReportWords: WordMatch[];
  articles: {
    title: string;
    description: string;
    url: string;
    publisher: string;
    publishedAt: string;
    sources: ArticleSource[];
  }[];
}

export interface CategoryResult {
  category: string;
  articles: number; // 이 카테고리에 배정된 묶음의 기사 수
  publishers: number;
  clusters: number;
  qualified: number;
  issues: TrendIssue[];
}

export interface TrendIssuesResult {
  window: { type: WindowType; start: string; end: string };
  stats: {
    calls: { used: number; limit: number; exhausted: boolean };
    articles: { beforeDedup: number; afterDedup: number; duplicates: number };
    publishers: number;
    clusters: number;
    multiArticleClusters: number;
    largestCluster: number;
    clusteringMs: number;
    failedKeywords: string[];
    skippedKeywords: string[];
    perKeyword: KeywordStats[];
  };
  categories: CategoryResult[];
  ranking?: RankingResult & { droppedByFlags: number };
}

// 일일 수집용 결과: 랭킹 id(RankedIssue.id) → 랭킹 후보 묶음
export interface CollectAndRankResult {
  window: TimeWindow;
  ranking: RankingResult & { droppedByFlags: number };
  candidates: Map<string, IssueCluster>;
}
