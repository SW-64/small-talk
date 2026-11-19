import { Article, RawArticle } from './trend-issues.types';
import { PublisherOptions, resolvePublisher } from './utils/domain';
import { stripHtml } from './utils/html';
import { normalizeUrl, UrlNormalizeOptions } from './utils/url';

export type NormalizeOptions = UrlNormalizeOptions & PublisherOptions;

export interface NormalizeResult {
  articles: Article[];
  duplicates: number;
}

/**
 * [2] 정리: HTML 제거·엔티티 복원, URL 정규화(originallink 우선), 언론사 키 추출,
 * 정규화 URL 기준으로 전체에서 한 번만 남긴다 (여러 카테고리·키워드에 잡히면 sources 를 합침)
 */
export function normalizeArticles(
  raws: RawArticle[],
  options: NormalizeOptions,
): NormalizeResult {
  const byUrl = new Map<string, Article>();

  for (const { item, category, keyword, publishedAt } of raws) {
    const url = normalizeUrl(item.originallink || item.link, options);
    const existing = byUrl.get(url);
    if (existing) {
      const known = existing.sources.some(
        (s) => s.category === category && s.keyword === keyword,
      );
      if (!known) existing.sources.push({ category, keyword });
      continue;
    }
    byUrl.set(url, {
      title: stripHtml(item.title),
      description: stripHtml(item.description),
      url,
      publisher: resolvePublisher(url, item.link, options),
      publishedAt,
      sources: [{ category, keyword }],
    });
  }

  return {
    articles: [...byUrl.values()],
    duplicates: raws.length - byUrl.size,
  };
}

export function countPublishers(articles: Article[]): number {
  return new Set(articles.map((a) => a.publisher)).size;
}
