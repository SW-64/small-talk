import { matchWords } from './flags';
import { Article, IssueCluster } from './trend-issues.types';

export interface BuildClusterOptions {
  categoryOrder: string[];
  majorDomains: ReadonlySet<string>;
  excludeWords: string[];
  marketReportWords: string[];
}

/**
 * 묶음을 카테고리 하나에 배정: 기사가 가장 많이 잡힌 카테고리(기사당 카테고리별 1표),
 * 동점이면 categoryOrder 앞쪽
 */
export function assignCategory(
  articles: Pick<Article, 'sources'>[],
  categoryOrder: string[],
): string {
  const votes = new Map<string, number>();
  for (const article of articles) {
    for (const category of new Set(article.sources.map((s) => s.category))) {
      votes.set(category, (votes.get(category) ?? 0) + 1);
    }
  }

  let best = categoryOrder[0];
  let bestVotes = 0;
  for (const category of categoryOrder) {
    const count = votes.get(category) ?? 0;
    if (count > bestVotes) {
      best = category;
      bestVotes = count;
    }
  }
  return best;
}

/**
 * [4] 세기: 묶음마다 기사 수, 전체·주요 언론사 수, 언론사 목록(기사 많은 순), 잡힌 키워드,
 * 배정 카테고리, 제외·시황 플래그. 묶음 안 기사는 보도 시각 오름차순이며, 대표 제목은 가장 이른 기사의 제목.
 */
export function buildIssueClusters(
  articles: Article[],
  groups: number[][],
  {
    categoryOrder,
    majorDomains,
    excludeWords,
    marketReportWords,
  }: BuildClusterOptions,
): IssueCluster[] {
  return groups.map((group) => {
    const members = group
      .map((i) => articles[i])
      .sort((a, b) => a.publishedAt.getTime() - b.publishedAt.getTime());

    const publisherCounts = new Map<string, number>();
    const keywords = new Set<string>();
    for (const article of members) {
      publisherCounts.set(
        article.publisher,
        (publisherCounts.get(article.publisher) ?? 0) + 1,
      );
      article.sources.forEach((s) => keywords.add(s.keyword));
    }
    const publishers = [...publisherCounts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([publisher]) => publisher);
    const majorPublishers = publishers.filter((p) => majorDomains.has(p));

    const titles = members.map((a) => a.title);
    const excludeReasons = matchWords(titles, excludeWords);
    const marketReportMatches = matchWords(titles, marketReportWords);

    return {
      representativeTitle: members[0].title,
      category: assignCategory(members, categoryOrder),
      articleCount: members.length,
      publisherCount: publishers.length,
      majorPublisherCount: majorPublishers.length,
      publishers,
      majorPublishers,
      keywords: [...keywords],
      excluded: excludeReasons.length > 0,
      excludeReasons,
      marketReport: marketReportMatches.length > 0,
      marketReportWords: marketReportMatches,
      articles: members,
    };
  });
}

export interface SelectOptions {
  minMajorPublishers: number;
  topN: number;
}

/**
 * [5] 선택 (카테고리 하나의 묶음 대상): 주요 언론사 수 ≥ minMajorPublishers 인 묶음만 남기고
 * 전체 언론사 수 내림차순(동점이면 기사 수 내림차순)으로 정렬해 상위 topN 개
 */
export function selectTopIssues(
  clusters: IssueCluster[],
  { minMajorPublishers, topN }: SelectOptions,
): { qualified: IssueCluster[]; top: IssueCluster[] } {
  const qualified = clusters
    .filter((c) => c.majorPublisherCount >= minMajorPublishers)
    .sort(
      (a, b) =>
        b.publisherCount - a.publisherCount || b.articleCount - a.articleCount,
    );
  return { qualified, top: qualified.slice(0, topN) };
}
