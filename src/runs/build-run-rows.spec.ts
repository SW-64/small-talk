import { RankedIssue, RankingResult } from '../news/ranking/ranking.types';
import { Article, IssueCluster } from '../news/trend-issues/trend-issues.types';
import { buildRunRows } from './build-run-rows';

const article = (url: string): Article => ({
  title: `${url} 제목`,
  description: `${url} 발췌문`,
  url,
  publisher: 'yna.co.kr',
  publishedAt: new Date('2026-11-19T01:00:00+09:00'),
  sources: [{ category: 'tech', keyword: 'AI' }],
});

const cluster = (urls: string[]): IssueCluster =>
  ({ articles: urls.map(article) }) as IssueCluster;

const ranked = (
  id: string,
  overrides: Partial<RankedIssue> = {},
): RankedIssue => ({
  id,
  category: 'tech',
  representativeTitle: `${id} 대표`,
  publisherCount: 3,
  searchTerms: [{ term: id, articleCount: 2 }],
  yesterdayRatio: 20,
  anchorRatio: 10,
  score: 2,
  categoryPosition: 1,
  categoryRank: 1,
  overallRank: 1,
  ...overrides,
});

const ranking = (issues: RankedIssue[]) => ({ issues }) as RankingResult;

describe('buildRunRows', () => {
  it('랭킹 이슈를 순위·점수와 함께 행으로 만든다', () => {
    const { issues } = buildRunRows(
      ranking([
        ranked('tech-1'),
        ranked('tech-2', {
          score: null,
          categoryPosition: 5,
          categoryRank: null,
          overallRank: null,
        }),
      ]),
      new Map([
        ['tech-1', cluster(['u1', 'u2'])],
        ['tech-2', cluster(['u3'])],
      ]),
    );
    expect(issues).toEqual([
      {
        rankingId: 'tech-1',
        category: 'tech',
        representativeTitle: 'tech-1 대표',
        searchTerms: [{ term: 'tech-1', articleCount: 2 }],
        searchScore: 2,
        categoryRank: 1,
        overallRank: 1,
        articleUrls: ['u1', 'u2'],
      },
      expect.objectContaining({
        rankingId: 'tech-2',
        searchScore: null,
        categoryRank: null,
        overallRank: null,
      }),
    ]);
  });

  it('기사는 URL 기준으로 한 번만 남기고 발췌문을 포함한다', () => {
    const { articles } = buildRunRows(
      ranking([ranked('a'), ranked('b')]),
      new Map([
        ['a', cluster(['u1', 'u2'])],
        ['b', cluster(['u2', 'u3'])],
      ]),
    );
    expect(articles.map((a) => a.url)).toEqual(['u1', 'u2', 'u3']);
    expect(articles[0]).toEqual({
      url: 'u1',
      title: 'u1 제목',
      description: 'u1 발췌문',
      publisher: 'yna.co.kr',
      publishedAt: new Date('2026-11-19T01:00:00+09:00'),
    });
  });

  it('묶음이 없는 랭킹 이슈가 있으면 실패한다', () => {
    expect(() => buildRunRows(ranking([ranked('a')]), new Map())).toThrow('a');
  });
});
