import { registerAs } from '@nestjs/config';

// 이슈 카드(3줄 요약 + 스몰토크) 생성 설정 — 실험하며 여기서만 바꾼다
export const issueCardsConfig = registerAs('issueCards', () => ({
  gemini: {
    apiKey: process.env.GOOGLE_API_KEY ?? '',
    model: process.env.GEMINI_MODEL || 'gemini-3.8-flash',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    // 무료 등급 기준: 모델별 분당 5회. 여유를 두고 4회로 요청 간격(15초)을 벌린다
    requestsPerMinute: 4,
    maxRetries: 2,
    retryBaseMs: 2000,
    maxRetryWaitMs: 90000, // 429 의 retryDelay 를 따르되 이 이상은 기다리지 않음
    timeoutMs: 240000, // 과부하 시 응답이 오래 걸림. Node fetch 의 헤더 대기 한도(300초) 아래로 유지
    maxCallsPerRun: 60, // 재시도를 포함한 실행당 실제 HTTP 요청 수 상한
  },

  maxIssuesPerCategory: 5,
  maxArticlesPerIssue: 15, // 프롬프트에 넣을 이슈당 최대 기사 수 (언론사가 겹치지 않게 우선 선택)
  summaryLines: 3,
  smalltalkCount: 3,
}));
