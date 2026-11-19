import { RankedIssue, RankingResult } from './ranking.types';

const TITLE_MAX = 40;
const HEADER =
  '순위 | 대표 제목 | 대표 검색어 | 점수 | 어제 ratio | 기준 ratio | 언론사 수 | 실패';

// 콘솔용 랭킹 요약 (카테고리별 순위표 / 랭킹 / 데이터랩 호출 수)
export function formatRankingSummary(
  result: RankingResult,
  { overallPrimaryN }: { overallPrimaryN: number },
): string[] {
  const { date, ages, anchorKeyword, calls, issues } = result;
  const lines = [
    `===== 랭킹 (${date}, 연령 ${ages.join(',')}, 기준 키워드 "${anchorKeyword}") =====`,
  ];

  for (const category of new Set(issues.map((i) => i.category))) {
    lines.push(`[카테고리 ${category}]`, `  ${HEADER}`);
    for (const issue of issues.filter((i) => i.category === category)) {
      const rank = issue.categoryRank ?? `(${issue.categoryPosition})`;
      lines.push(`  ${row(rank, issue)}`);
    }
  }

  const overall = issues
    .filter((i) => i.overallRank !== null)
    .sort((a, b) => (a.overallRank ?? 0) - (b.overallRank ?? 0));
  lines.push(`[랭킹 ${overall.length}개 (카드 이슈 안)]`, `  ${HEADER}`);
  for (const issue of overall) {
    const rank =
      (issue.overallRank ?? 0) > overallPrimaryN
        ? `${issue.overallRank}(예비)`
        : (issue.overallRank ?? '-');
    lines.push(`  ${row(rank, issue)}`);
  }

  lines.push(`[데이터랩 호출] ${calls.used}/${calls.limit}회`);
  return lines;
}

function row(rank: number | string, issue: RankedIssue): string {
  const terms = issue.searchTerms.map((t) => t.term).join(', ') || '-';
  return [
    rank,
    truncate(issue.representativeTitle),
    terms,
    format(issue.score),
    format(issue.yesterdayRatio),
    format(issue.anchorRatio),
    issue.publisherCount,
    issue.failureReason ?? '-',
  ].join(' | ');
}

function format(value: number | null): string {
  return value === null ? '-' : value.toFixed(2);
}

function truncate(text: string): string {
  const chars = [...text];
  return chars.length > TITLE_MAX
    ? `${chars.slice(0, TITLE_MAX).join('')}…`
    : text;
}
