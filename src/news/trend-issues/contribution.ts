import { IssueCluster } from './trend-issues.types';

export interface KeywordContribution {
  topIssues: number;
  soloTopIssues: number;
}

// 모든 카테고리의 상위 이슈를 대상으로 키워드별 기여 수와 단독 기여 수를 센다
export function computeContributions(
  topIssues: IssueCluster[],
): Map<string, KeywordContribution> {
  const contributions = new Map<string, KeywordContribution>();
  for (const issue of topIssues) {
    for (const keyword of issue.keywords) {
      const current = contributions.get(keyword) ?? {
        topIssues: 0,
        soloTopIssues: 0,
      };
      current.topIssues++;
      if (issue.keywords.length === 1) current.soloTopIssues++;
      contributions.set(keyword, current);
    }
  }
  return contributions;
}
