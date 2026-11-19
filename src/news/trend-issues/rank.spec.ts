import { assignCategory, buildIssueClusters, selectTopIssues } from './rank';
import { Article } from './trend-issues.types';

const ORDER = ['economy', 'tech', 'culture'];

const OPTIONS = {
  categoryOrder: ORDER,
  majorDomains: new Set(['p0.com', 'p1.com', 'a.com']),
  excludeWords: ['수사', '논란'],
  marketReportWords: ['마감'],
};

const article = (
  title: string,
  publisher: string,
  hour: number,
  keywords = ['기준금리'],
  category = 'economy',
): Article => ({
  title,
  description: '',
  url: `https://${publisher}/${title}`,
  publisher,
  publishedAt: new Date(Date.UTC(2026, 9, 27, hour)),
  sources: keywords.map((keyword) => ({ category, keyword })),
});

const sources = (...categories: string[]) => ({
  sources: categories.map((category) => ({ category, keyword: 'k' })),
});

describe('assignCategory', () => {
  it('기사가 가장 많이 잡힌 카테고리로 배정한다', () => {
    expect(
      assignCategory(
        [sources('tech'), sources('tech'), sources('economy')],
        ORDER,
      ),
    ).toBe('tech');
  });

  it('동점이면 설정 순서가 앞선 카테고리로 배정한다', () => {
    expect(assignCategory([sources('culture'), sources('tech')], ORDER)).toBe(
      'tech',
    );
  });

  it('한 기사가 여러 카테고리에 잡히면 각 카테고리에 한 표씩 준다', () => {
    expect(
      assignCategory([sources('economy', 'tech'), sources('tech')], ORDER),
    ).toBe('tech');
  });

  it('같은 카테고리의 여러 키워드에 잡혀도 기사당 한 표만 준다', () => {
    expect(
      assignCategory(
        [
          sources('tech', 'tech', 'tech'),
          sources('economy'),
          sources('economy'),
        ],
        ORDER,
      ),
    ).toBe('economy');
  });
});

describe('buildIssueClusters', () => {
  const articles = [
    article('늦은 기사', 'a.com', 10),
    article('가장 이른 기사', 'b.com', 1, ['환율']),
    article('중간 기사', 'a.com', 5, ['기준금리', '환율']),
  ];
  const [cluster] = buildIssueClusters(articles, [[0, 1, 2]], OPTIONS);

  it('기사 수, 서로 다른 언론사 수를 센다', () => {
    expect(cluster.articleCount).toBe(3);
    expect(cluster.publisherCount).toBe(2);
  });

  it('언론사 목록은 기사 많은 순', () => {
    expect(cluster.publishers).toEqual(['a.com', 'b.com']);
  });

  it('주요 언론사는 같은 언론사의 여러 기사를 한 번만 센다', () => {
    expect(cluster.majorPublisherCount).toBe(1);
    expect(cluster.majorPublishers).toEqual(['a.com']);
  });

  it('잡힌 키워드는 합집합', () => {
    expect(cluster.keywords.sort()).toEqual(['기준금리', '환율']);
  });

  it('대표 제목은 가장 이른 기사의 제목, 기사는 시각 오름차순', () => {
    expect(cluster.representativeTitle).toBe('가장 이른 기사');
    expect(cluster.articles.map((a) => a.title)).toEqual([
      '가장 이른 기사',
      '중간 기사',
      '늦은 기사',
    ]);
  });

  it('카테고리를 배정한다', () => {
    expect(cluster.category).toBe('economy');
  });

  it('제목에 제외 단어가 있으면 플래그와 사유를 표시한다', () => {
    const list = [
      article('검찰 수사 착수', 'a.com', 1),
      article('수사 논란 확산', 'b.com', 2),
    ];
    const [flagged] = buildIssueClusters(list, [[0, 1]], OPTIONS);
    expect(flagged.excluded).toBe(true);
    expect(flagged.excludeReasons).toEqual([
      { word: '수사', articleCount: 2 },
      { word: '논란', articleCount: 1 },
    ]);
  });

  it('제목에 시황 단어가 있으면 marketReport 를 표시한다', () => {
    const [market] = buildIssueClusters(
      [article('코스피 상승 마감', 'a.com', 1)],
      [[0]],
      OPTIONS,
    );
    expect(market.marketReport).toBe(true);
    expect(market.marketReportWords).toEqual([
      { word: '마감', articleCount: 1 },
    ]);
    expect(market.excluded).toBe(false);
  });
});

describe('selectTopIssues', () => {
  // 언론사는 p0.com, p1.com ... 이고 OPTIONS 의 주요 언론사는 p0, p1
  const make = (id: string, publishers: number, articles: number) => {
    const list = Array.from({ length: articles }, (_, i) =>
      article(`${id}-${i}`, `p${i % publishers}.com`, i),
    );
    return buildIssueClusters(list, [list.map((_, i) => i)], OPTIONS)[0];
  };

  const clusters = [
    make('one-major', 1, 9),
    make('three-a', 3, 3),
    make('five', 5, 5),
    make('three-b', 3, 6),
  ];

  it('주요 언론사 수가 최소값 미만인 묶음은 제외한다', () => {
    const { qualified } = selectTopIssues(clusters, {
      minMajorPublishers: 2,
      topN: 10,
    });
    expect(qualified.map((c) => c.representativeTitle)).not.toContain(
      'one-major-0',
    );
    expect(qualified).toHaveLength(3);
  });

  it('전체 언론사 수 내림차순, 동점이면 기사 수 내림차순', () => {
    const { qualified } = selectTopIssues(clusters, {
      minMajorPublishers: 2,
      topN: 10,
    });
    expect(qualified.map((c) => c.representativeTitle)).toEqual([
      'five-0',
      'three-b-0',
      'three-a-0',
    ]);
  });

  it('상위 topN 개만 선택한다', () => {
    const { qualified, top } = selectTopIssues(clusters, {
      minMajorPublishers: 1,
      topN: 2,
    });
    expect(qualified).toHaveLength(4);
    expect(top.map((c) => c.representativeTitle)).toEqual([
      'five-0',
      'three-b-0',
    ]);
  });

  it('제외 플래그가 있어도 순위에 남긴다', () => {
    const list = [
      article('수사 착수', 'p0.com', 1),
      article('수사 확대', 'p1.com', 2),
    ];
    const flagged = buildIssueClusters(list, [[0, 1]], OPTIONS);
    const { top } = selectTopIssues(flagged, {
      minMajorPublishers: 2,
      topN: 10,
    });
    expect(top).toHaveLength(1);
    expect(top[0].excluded).toBe(true);
  });
});
