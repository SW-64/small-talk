import type { Category } from '../database/entities/constants';
import type { IssueSearchTerm } from '../database/entities/issue.entity';
import type { RankingResult } from '../news/ranking/ranking.types';
import type {
  Article as ClusterArticle,
  IssueCluster,
} from '../news/trend-issues/trend-issues.types';

export interface IssueRow {
  rankingId: string;
  category: Category;
  representativeTitle: string;
  searchTerms: IssueSearchTerm[];
  searchScore: number | null;
  categoryRank: number | null;
  overallRank: number | null;
  articleUrls: string[];
}

export interface ArticleRow {
  url: string;
  title: string;
  description: string;
  publisher: string;
  publishedAt: Date;
}

/**
 * 랭킹 결과 + 후보 묶음 → DB 저장용 행. 후보 전부를 저장하고 순위 밖 이슈는 순위를 비운다.
 * 기사는 URL 기준으로 한 번만 남긴다.
 */
export function buildRunRows(
  ranking: RankingResult,
  candidates: Map<string, IssueCluster>,
): { issues: IssueRow[]; articles: ArticleRow[] } {
  const articles = new Map<string, ArticleRow>();

  const issues = ranking.issues.map((ranked): IssueRow => {
    const cluster = candidates.get(ranked.id);
    if (!cluster) {
      throw new Error(`랭킹 이슈 ${ranked.id} 의 기사 묶음이 없습니다`);
    }
    for (const article of cluster.articles) {
      if (!articles.has(article.url)) {
        articles.set(article.url, toArticleRow(article));
      }
    }
    return {
      rankingId: ranked.id,
      category: ranked.category as Category,
      representativeTitle: ranked.representativeTitle,
      searchTerms: ranked.searchTerms,
      searchScore: ranked.score,
      categoryRank: ranked.categoryRank,
      overallRank: ranked.overallRank,
      articleUrls: [...new Set(cluster.articles.map((a) => a.url))],
    };
  });

  return { issues, articles: [...articles.values()] };
}

function toArticleRow(article: ClusterArticle): ArticleRow {
  return {
    url: article.url,
    title: article.title,
    description: article.description,
    publisher: article.publisher,
    publishedAt: article.publishedAt,
  };
}
