import { registerAs } from '@nestjs/config';

// 검색량 기반 랭킹 설정 — 임계값과 검색어 규칙은 실험하며 여기서만 바꾼다
export const rankingConfig = registerAs('ranking', () => ({
  ages: ['4', '5', '6'], // 데이터랩 연령 코드: 25~39세
  days: 8, // 어제 포함 최근 8일

  datalab: {
    batchSize: 5, // 데이터랩 keywordGroups 상한
    maxDatalabCallsPerRun: 50, // 재시도를 포함한 실행당 실제 HTTP 요청 수 상한
    maxRetries: 3,
    retryBaseMs: 500,
    timeoutMs: 5000,
  },

  spike: {
    zeroBaselineRatio: 1, // 이전 평균이 0일 때 분모로 쓰는 값
    minYesterdayRatio: 5, // 어제 ratio 가 이 값 미만이면 lowVolume 표시
  },

  overallTopN: 15,
  overallPrimaryN: 10, // 전체 순위에서 이 순위까지 top, 나머지는 reserve

  searchTerms: {
    maxTerms: 3,
    minCoverage: 0.5, // 제목의 이 비율 이상에 등장하는 표현을 우선
    headlineLabels: [
      '단독',
      '속보',
      '종합',
      '긴급',
      '포토',
      '영상',
      '인터뷰',
      '르포',
      '기획',
      '사설',
      '칼럼',
      '특징주',
    ],
    stopwords: [
      '단독',
      '속보',
      '종합',
      '밝혀',
      '밝혔다',
      '밝힌',
      '발표',
      '발표했다',
      '발표한',
      '기록',
      '기록했다',
      '기록한',
      '최고',
      '최대',
      '최저',
      '역대',
      '사상',
      '오늘',
      '어제',
      '내일',
      '올해',
      '지난',
      '지난해',
      '이번',
      '다음',
      '전망',
      '예정',
      '관련',
      '위해',
      '대해',
      '통해',
      '따라',
      '이후',
      '이전',
      '현재',
      '결국',
      '공개',
      '개최',
      '진행',
      '확인',
      '화제',
      '돌파',
    ],
    // 긴 조사부터 확인한다
    particles: [
      '으로',
      '에서',
      '에게',
      '까지',
      '부터',
      '보다',
      '처럼',
      '은',
      '는',
      '이',
      '가',
      '을',
      '를',
      '에',
      '의',
      '로',
      '와',
      '과',
      '도',
      '만',
    ],
  },
}));
