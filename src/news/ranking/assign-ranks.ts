export interface RankableIssue {
  id: string;
  category: string;
  score: number | null;
  publisherCount: number;
}

export interface AssignedRanks {
  categoryPosition: number;
  categoryRank: number | null;
  overallRank: number | null;
}

export interface AssignRanksOptions {
  cardsPerCategory: number;
  overallTopN: number;
}

// 점수 내림차순, 동점이면 언론사 수. 점수 없음(null)은 뒤에서 언론사 수 순
export function compareByScore(a: RankableIssue, b: RankableIssue): number {
  if (a.score === null || b.score === null) {
    if (a.score !== b.score) return a.score === null ? 1 : -1;
    return b.publisherCount - a.publisherCount;
  }
  return b.score - a.score || b.publisherCount - a.publisherCount;
}

/**
 * 카테고리 순위: 카테고리 안에서 정렬해 1~cardsPerCategory 위만 categoryRank 를 준다 (카드 이슈).
 * 랭킹 순위: 카드 이슈만 모아 정렬해 1~overallTopN 위에 overallRank 를 준다.
 * 반환 순서는 카테고리 첫 등장 순 → 카테고리 안 정렬 순.
 */
export function assignRanks<T extends RankableIssue>(
  issues: T[],
  { cardsPerCategory, overallTopN }: AssignRanksOptions,
): (T & AssignedRanks)[] {
  const categories = [...new Set(issues.map((i) => i.category))];

  const ranked = categories.flatMap((category) =>
    issues
      .filter((issue) => issue.category === category)
      .sort(compareByScore)
      .map((issue, index) => ({
        ...issue,
        categoryPosition: index + 1,
        categoryRank: index < cardsPerCategory ? index + 1 : null,
        overallRank: null as number | null,
      })),
  );

  ranked
    .filter((issue) => issue.categoryRank !== null)
    .sort(compareByScore)
    .slice(0, overallTopN)
    .forEach((issue, index) => {
      issue.overallRank = index + 1;
    });

  return ranked;
}
