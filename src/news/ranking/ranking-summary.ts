import { RankedIssue, RankingResult } from './ranking.types';

const TITLE_MAX = 40;
const HEADER =
  '순위 | 대표 제목 | 대표 검색어 | spike | 어제 ratio | 언론사 수 | 플래그';

// 콘솔용 랭킹 요약 (카테고리별 랭킹표 / 전체 TOP N / 데이터랩 호출 수)
export function formatRankingSummary(result: RankingResult): string[] {
  const { period, ages, calls, categories, overall } = result;
  const lines = [
    `===== 랭킹 (${period.startDate} ~ ${period.endDate}, 연령 ${ages.join(',')}) =====`,
  ];

  for (const { category, issues } of categories) {
    lines.push(`[랭킹 ${category}]`, `  ${HEADER}`);
    for (const issue of issues) lines.push(`  ${row(issue.rank, issue)}`);
  }

  lines.push(`[전체 TOP ${overall.length}]`, `  ${HEADER}`);
  for (const issue of overall) {
    const rank = issue.tier === 'reserve' ? `${issue.rank}(예비)` : issue.rank;
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
    issue.spike === null ? '-' : issue.spike.toFixed(2),
    issue.yesterdayRatio === null ? '-' : issue.yesterdayRatio.toFixed(2),
    issue.publisherCount,
    issue.flags.join(',') || '-',
  ].join(' | ');
}

function truncate(text: string): string {
  const chars = [...text];
  return chars.length > TITLE_MAX
    ? `${chars.slice(0, TITLE_MAX).join('')}…`
    : text;
}
