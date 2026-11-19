import { NaverNewsItem } from '../dto/naver-news.types';
import { countPublishers, normalizeArticles } from './normalize';
import { RawArticle } from './trend-issues.types';

const OPTIONS = {
  trackingParams: ['did'],
  trackingParamPrefixes: ['utm_'],
  domainPrefixes: ['www', 'm', 'news', 'biz'],
  naverOidToDomain: new Map([['023', 'chosun.com']]),
};

const raw = (
  item: Partial<NaverNewsItem>,
  keyword = '기준금리',
  category = 'economy',
): RawArticle => ({
  item: {
    title: '제목',
    originallink: '',
    link: '',
    description: '',
    pubDate: 'Wed, 28 Oct 2026 01:00:00 +0900',
    ...item,
  },
  category,
  keyword,
  publishedAt: new Date('2026-10-28T01:00:00+09:00'),
});

describe('normalizeArticles', () => {
  it('제목·요약의 태그를 제거하고 엔티티를 복원한다', () => {
    const { articles } = normalizeArticles(
      [
        raw({
          title: '<b>기준금리</b> &quot;동결&quot;',
          description: '한은 &amp; 정부',
          originallink: 'https://www.a.com/1',
        }),
      ],
      OPTIONS,
    );
    expect(articles[0].title).toBe('기준금리 "동결"');
    expect(articles[0].description).toBe('한은 & 정부');
  });

  it('URL 은 originallink 우선, 비어 있으면 link 를 쓴다', () => {
    const { articles } = normalizeArticles(
      [
        raw({
          originallink: 'https://www.a.com/1',
          link: 'https://n.news.naver.com/article/001/1',
        }),
        raw({
          originallink: '',
          link: 'https://n.news.naver.com/article/999/2',
        }),
      ],
      OPTIONS,
    );
    expect(articles.map((a) => a.url)).toEqual([
      'https://www.a.com/1',
      'https://n.news.naver.com/article/999/2',
    ]);
  });

  describe('언론사 키', () => {
    const publisherOf = (item: Partial<NaverNewsItem>) =>
      normalizeArticles([raw(item)], OPTIONS).articles[0].publisher;

    it('link 가 네이버 뉴스면 originallink 가 있어도 언론사 번호를 쓴다', () => {
      expect(
        publisherOf({
          originallink: 'https://www.a.com/1',
          link: 'https://n.news.naver.com/mnews/article/999/1',
        }),
      ).toBe('naver:999');
    });

    it('주요 언론사 번호는 도메인으로 바꿔 도메인 키와 합쳐진다', () => {
      const { articles } = normalizeArticles(
        [
          raw({
            originallink: 'https://biz.chosun.com/1',
            link: 'https://n.news.naver.com/mnews/article/023/1',
          }),
          raw({
            originallink: 'https://www.chosun.com/2',
            link: 'https://www.chosun.com/2',
          }),
        ],
        OPTIONS,
      );
      expect(articles.map((a) => a.publisher)).toEqual([
        'chosun.com',
        'chosun.com',
      ]);
      expect(countPublishers(articles)).toBe(1);
    });

    it('네이버 링크가 아니면 URL 의 핵심 도메인을 쓴다', () => {
      expect(
        publisherOf({
          originallink: 'https://news.a.com/1',
          link: 'https://news.a.com/1',
        }),
      ).toBe('a.com');
    });
  });

  it('정규화 URL 기준으로 중복을 제거하고 키워드를 합친다', () => {
    const { articles, duplicates } = normalizeArticles(
      [
        raw(
          { originallink: 'https://www.a.com/view?idxno=1&did=NA' },
          '기준금리',
        ),
        raw({ originallink: 'https://www.a.com/view?idxno=1' }, '환율'),
        raw({ originallink: 'https://www.a.com/view?idxno=2' }, '환율'),
        raw(
          { originallink: 'https://www.a.com/view?idxno=1&utm_source=x' },
          '환율',
        ),
      ],
      OPTIONS,
    );
    expect(articles).toHaveLength(2);
    expect(duplicates).toBe(2);
    expect(articles[0].sources).toEqual([
      { category: 'economy', keyword: '기준금리' },
      { category: 'economy', keyword: '환율' },
    ]);
  });

  it('여러 카테고리에 잡힌 같은 기사는 한 번만 남기고 출처를 모두 기록한다', () => {
    const { articles, duplicates } = normalizeArticles(
      [
        raw({ originallink: 'https://a.com/1' }, '환율', 'economy'),
        raw({ originallink: 'https://a.com/1' }, '반도체', 'tech'),
      ],
      OPTIONS,
    );
    expect(articles).toHaveLength(1);
    expect(duplicates).toBe(1);
    expect(articles[0].sources).toEqual([
      { category: 'economy', keyword: '환율' },
      { category: 'tech', keyword: '반도체' },
    ]);
  });

  it('countPublishers 는 고유 언론사 키 수', () => {
    const { articles } = normalizeArticles(
      [
        raw({ originallink: 'https://www.chosun.com/1' }),
        raw({ originallink: 'https://biz.chosun.com/2' }),
        raw({ originallink: 'https://www.mk.co.kr/3' }),
      ],
      OPTIONS,
    );
    expect(countPublishers(articles)).toBe(2);
  });
});
