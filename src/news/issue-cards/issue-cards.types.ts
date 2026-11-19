import { TrendIssuesResult } from '../trend-issues/trend-issues.types';

export interface CardSource {
  id: number; // 프롬프트에 넣은 기사 번호 (1부터)
  title: string;
  description: string; // 네이버 발췌문 (DB 저장·재생성 입력용)
  url: string;
  publisher: string;
  publishedAt: string;
}

interface CardBase {
  issueRank: number; // trend-issues 카테고리 내 순위
  representativeTitle: string;
  publisherCount: number;
  articleCount: number;
}

export interface GeneratedCard extends CardBase {
  status: 'ok';
  summary: { text: string; sourceIds: number[] }[];
  smalltalk: string[];
  sources: CardSource[]; // 프롬프트에 넣은 기사 전체 (sourceIds 가 가리키는 대상)
}

export interface FailedCard extends CardBase {
  status: 'failed';
  reason: 'apiError' | 'invalidOutput' | 'budgetExceeded';
  error: string;
}

export type IssueCard = GeneratedCard | FailedCard;

export interface IssueCardsResult {
  window: TrendIssuesResult['window'];
  model: string;
  calls: {
    news: TrendIssuesResult['stats']['calls'];
    gemini: { used: number; limit: number; exhausted: boolean };
  };
  categories: {
    category: string;
    candidates: number; // 상위 이슈 수 (제외·시황 플래그 포함)
    droppedByFlags: number; // 제외·시황 플래그로 카드 대상에서 빠진 이슈 수
    cards: IssueCard[];
  }[];
}
