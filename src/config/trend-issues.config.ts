import { registerAs } from '@nestjs/config';

type KeywordInput = string | { text: string; seasonal?: boolean };

// 배열 순서가 곧 묶음 카테고리 배정의 동점 우선순위.
// 카테고리 추가·삭제는 이 배열만 고치면 된다. 계절 키워드는 { text, seasonal: true } 로 표시
const CATEGORIES: { id: string; keywords: KeywordInput[] }[] = [
  {
    id: 'economy',
    keywords: [
      '금리',
      '환율',
      '주식',
      '부동산',
      '물가',
      '연봉',
      '소비 트렌드',
      '할인',
    ],
  },
  {
    id: 'tech',
    keywords: [
      'AI',
      '스마트폰',
      '반도체',
      '로봇',
      '자율주행',
      '전기차',
      '우주',
      '스타트업',
    ],
  },
  {
    id: 'culture',
    keywords: [
      '영화',
      '드라마',
      '예능',
      '공연',
      '전시',
      '축제',
      '아이돌',
      '베스트셀러',
    ],
  },
  {
    id: 'society',
    keywords: [
      '직장인',
      'MZ',
      '맛집',
      '여행',
      '출퇴근',
      '편의점',
      '건강',
      '반려동물',
    ],
  },
  {
    id: 'environment',
    keywords: [
      '날씨',
      { text: '한파', seasonal: true },
      '미세먼지',
      '재활용',
      '친환경',
      '기후',
      '텀블러',
      '플라스틱',
    ],
  },
];

// 주요 언론사: 통신사·방송사·종합일간지·경제지 위주.
// domain 은 정규화된 언론사 키, naverOid 는 n.news.naver.com 경로의 언론사 번호
const MAJOR_PUBLISHERS: { name: string; domain: string; naverOid: string }[] = [
  // 통신사
  { name: '연합뉴스', domain: 'yna.co.kr', naverOid: '001' },
  { name: '뉴시스', domain: 'newsis.com', naverOid: '003' },
  { name: '뉴스1', domain: 'news1.kr', naverOid: '421' },
  // 방송사
  { name: 'KBS', domain: 'kbs.co.kr', naverOid: '056' },
  { name: 'MBC', domain: 'imbc.com', naverOid: '214' },
  { name: 'SBS', domain: 'sbs.co.kr', naverOid: '055' },
  { name: 'JTBC', domain: 'jtbc.co.kr', naverOid: '437' },
  { name: 'YTN', domain: 'ytn.co.kr', naverOid: '052' },
  { name: '연합뉴스TV', domain: 'yonhapnewstv.co.kr', naverOid: '422' },
  { name: 'TV조선', domain: 'tvchosun.com', naverOid: '448' },
  { name: '채널A', domain: 'ichannela.com', naverOid: '449' },
  { name: 'MBN', domain: 'mbn.co.kr', naverOid: '057' },
  // 종합일간지
  { name: '조선일보', domain: 'chosun.com', naverOid: '023' },
  { name: '중앙일보', domain: 'joongang.co.kr', naverOid: '025' },
  { name: '동아일보', domain: 'donga.com', naverOid: '020' },
  { name: '한겨레', domain: 'hani.co.kr', naverOid: '028' },
  { name: '경향신문', domain: 'khan.co.kr', naverOid: '032' },
  { name: '한국일보', domain: 'hankookilbo.com', naverOid: '469' },
  { name: '국민일보', domain: 'kmib.co.kr', naverOid: '005' },
  { name: '서울신문', domain: 'seoul.co.kr', naverOid: '081' },
  { name: '세계일보', domain: 'segye.com', naverOid: '022' },
  { name: '문화일보', domain: 'munhwa.com', naverOid: '021' },
  // 경제지
  { name: '한국경제', domain: 'hankyung.com', naverOid: '015' },
  { name: '매일경제', domain: 'mk.co.kr', naverOid: '009' },
  { name: '서울경제', domain: 'sedaily.com', naverOid: '011' },
  { name: '머니투데이', domain: 'mt.co.kr', naverOid: '008' },
  { name: '이데일리', domain: 'edaily.co.kr', naverOid: '018' },
  { name: '아시아경제', domain: 'asiae.co.kr', naverOid: '277' },
  { name: '파이낸셜뉴스', domain: 'fnnews.com', naverOid: '014' },
  { name: '헤럴드경제', domain: 'heraldcorp.com', naverOid: '016' },
];

// 트렌드 이슈 추출 파이프라인 설정 — 키워드/임계값은 실험하며 여기서만 바꾼다
export const trendIssuesConfig = registerAs('trendIssues', () => ({
  categories: CATEGORIES.map(({ id, keywords }) => ({
    id,
    keywords: keywords.map((keyword) =>
      typeof keyword === 'string'
        ? { text: keyword, seasonal: false }
        : { text: keyword.text, seasonal: keyword.seasonal ?? false },
    ),
  })),

  // previousDay 수집 기간: 전날 startHourKst시 ~ 당일 startHourKst시 (KST)
  window: { startHourKst: 6 },

  fetch: {
    display: 100,
    maxStart: 1000, // NAVER 검색 API의 start 상한
    maxRetries: 3,
    retryBaseMs: 500,
    timeoutMs: 5000,
    maxCallsPerRun: 700, // 재시도를 포함한 실행당 실제 HTTP 요청 수 상한
    concurrency: 3, // 동시에 처리할 키워드 수
  },

  clustering: {
    ngramSizes: [2, 3],
    similarityThreshold: 0.5,
  },

  selection: {
    minMajorPublishers: 2,
    topN: 10,
    rankingCandidatesPerCategory: 10, // 랭킹 단계로 넘길 카테고리별 최대 이슈 수
  },

  // 제목에 포함되면 묶음에 플래그만 표시한다 (개발 단계에서는 삭제하지 않음)
  excludeWords: [
    '사망',
    '숨져',
    '참사',
    '살인',
    '폭행',
    '수사',
    '구속',
    '기소',
    '재판',
    '논란',
    '의혹',
    '선거',
  ],
  marketReportWords: [
    '개장시황',
    '마감',
    '출발',
    '강보합',
    '약보합',
    '시황',
    '혼조세',
  ],

  majorPublishers: MAJOR_PUBLISHERS,

  // URL 정규화 시 제거할 추적용 쿼리 파라미터 (utm_* 는 접두사로 일괄 제거)
  trackingParams: ['did', 'fbclid', 'gclid'],
  trackingParamPrefixes: ['utm_'],

  // 언론사 도메인 정리 시 앞에서 제거할 서브도메인
  domainPrefixes: [
    'www',
    'm',
    'mobile',
    'news',
    'biz',
    'en',
    'it',
    'sports',
    'imnews',
    'mbnmoney',
    'view',
  ],
}));
