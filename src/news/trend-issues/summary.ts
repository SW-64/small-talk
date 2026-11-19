import {
  KeywordStats,
  TrendIssue,
  TrendIssuesResult,
} from './trend-issues.types';

const TITLE_MAX = 40;

// 콘솔용 최종 요약 (전체 / 카테고리별 순위표 / 키워드별 기여도)
export function formatSummary(result: TrendIssuesResult): string[] {
  const { window, stats, categories } = result;
  const lines: string[] = [
    `===== 요약 (${window.type}) ${window.start} ~ ${window.end} =====`,
    `[전체] 호출 ${stats.calls.used}/${stats.calls.limit}회, 기사 중복 제거 전 ${stats.articles.beforeDedup}건 → 후 ${stats.articles.afterDedup}건, 언론사 ${stats.publishers}곳`,
  ];

  for (const category of categories) {
    lines.push(
      `[카테고리 ${category.category}] 기사 ${category.articles}건, 언론사 ${category.publishers}곳, 상위 ${category.issues.length}개 이슈`,
      '  순위 | 대표 제목 | 전체 언론사 수 | 주요 언론사 수 | 기사 수 | 플래그',
    );
    for (const issue of category.issues) {
      lines.push(
        `  ${issue.rank} | ${truncate(issue.representativeTitle)} | ${issue.publisherCount} | ${issue.majorPublisherCount} | ${issue.articleCount} | ${formatFlags(issue)}`,
      );
    }
  }

  lines.push(
    '[키워드별 기여도]',
    '  카테고리 | 키워드 | 호출 수 | 범위 내 기사 | 상위 이슈 기여 | 단독 기여 | 상태',
  );
  for (const k of stats.perKeyword) {
    lines.push(
      `  ${k.category} | ${k.keyword} | ${k.calls} | ${k.articlesInWindow} | ${k.topIssues} | ${k.soloTopIssues} | ${formatStatus(k)}`,
    );
  }
  return lines;
}

function formatFlags(issue: TrendIssue): string {
  const flags: string[] = [];
  if (issue.excluded) {
    flags.push(`제외(${issue.excludeReasons.map((r) => r.word).join(',')})`);
  }
  if (issue.marketReport) flags.push('시황');
  return flags.join(' ') || '-';
}

function formatStatus(k: KeywordStats): string {
  const status = [
    k.seasonal ? '계절' : '',
    k.limitReached ? '한도 도달' : '',
    k.failed ? '실패' : '',
    k.skipped ? '예산 건너뜀' : '',
    k.budgetStopped ? '예산 중단' : '',
  ].filter(Boolean);
  return status.join(', ') || '-';
}

function truncate(text: string): string {
  const chars = [...text];
  return chars.length > TITLE_MAX
    ? `${chars.slice(0, TITLE_MAX).join('')}…`
    : text;
}
