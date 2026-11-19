import { trendIssuesConfig } from '../../../config/trend-issues.config';
import { extractPublisherKey } from './domain';

const PREFIXES = ['www', 'm', 'mobile', 'news', 'biz', 'en'];
const key = (url: string) => extractPublisherKey(url, PREFIXES);

describe('extractPublisherKey', () => {
  it('www., biz., m., news. 같은 앞부분을 제거해 핵심 도메인만 남긴다', () => {
    expect(key('https://www.chosun.com/economy/2026/10/28/ABC/')).toBe(
      'chosun.com',
    );
    expect(key('https://biz.chosun.com/stock/2026/10/28/ABC/')).toBe(
      'chosun.com',
    );
    expect(key('https://chosun.com/a')).toBe('chosun.com');
    expect(key('https://m.mk.co.kr/news/economy/1')).toBe('mk.co.kr');
    expect(key('https://news.kbs.co.kr/news/view.do?ncd=1')).toBe('kbs.co.kr');
    expect(key('https://www.news.example.com/a')).toBe('example.com');
  });

  it('co.kr 같은 2단계 접미사나 등록 도메인 자체는 깎지 않는다', () => {
    expect(key('https://news.co.kr/a')).toBe('news.co.kr');
    expect(key('https://m.com/a')).toBe('m.com');
  });

  it('목록에 없는 서브도메인은 유지한다', () => {
    expect(key('https://sports.chosun.com/a')).toBe('sports.chosun.com');
  });

  it('설정의 새 하위 도메인을 제거한다', () => {
    const { domainPrefixes } = trendIssuesConfig();
    const configured = (url: string) =>
      extractPublisherKey(url, domainPrefixes);

    expect(configured('https://it.chosun.com/a')).toBe('chosun.com');
    expect(configured('https://sports.khan.co.kr/a')).toBe('khan.co.kr');
    expect(configured('https://imnews.imbc.com/a')).toBe('imbc.com');
    expect(configured('https://mbnmoney.mbn.co.kr/a')).toBe('mbn.co.kr');
    expect(configured('https://view.asiae.co.kr/a')).toBe('asiae.co.kr');
  });

  it('host 는 대소문자를 구분하지 않는다', () => {
    expect(key('https://WWW.Hankyung.COM/article/1')).toBe('hankyung.com');
  });

  describe('네이버 뉴스 링크', () => {
    it('/article/{언론사번호}/... 경로의 번호를 키로 쓴다', () => {
      expect(key('https://n.news.naver.com/article/023/0003812345')).toBe(
        'naver:023',
      );
      expect(
        key('https://n.news.naver.com/article/023/0003812345?sid=101'),
      ).toBe('naver:023');
    });

    it('/mnews/article/{언론사번호}/... 경로도 지원한다', () => {
      expect(key('https://n.news.naver.com/mnews/article/015/0005012345')).toBe(
        'naver:015',
      );
      expect(key('https://m.news.naver.com/article/015/0005012345')).toBe(
        'naver:015',
      );
    });

    it('언론사 번호가 다르면 서로 다른 언론사로 센다', () => {
      const a = key('https://n.news.naver.com/mnews/article/023/0003812345');
      const b = key('https://n.news.naver.com/mnews/article/015/0005012345');
      expect(a).not.toBe(b);
    });

    it('옛 형식의 oid 쿼리도 지원한다', () => {
      expect(
        key(
          'https://news.naver.com/main/read.naver?mode=LSD&oid=009&aid=0005000000',
        ),
      ).toBe('naver:009');
    });

    it('언론사 번호를 찾을 수 없으면 naver.com', () => {
      expect(key('https://n.news.naver.com/main/ranking')).toBe('naver.com');
    });
  });

  it('URL 이 아니면 원문을 소문자로 돌려준다', () => {
    expect(key('Not A Url')).toBe('not a url');
  });
});
