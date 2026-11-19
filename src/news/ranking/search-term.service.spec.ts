import { rankingConfig } from '../../config/ranking.config';
import { SearchTermService } from './search-term.service';

describe('SearchTermService', () => {
  const service = new SearchTermService(rankingConfig());
  const terms = (titles: string[]) =>
    service.extract(titles).map((t) => t.term);

  it('말머리를 제거하고 공통 표현을 고른다', () => {
    const result = terms([
      '[단독] 테슬라 사이버트럭 생산 중단',
      '[속보] 테슬라 사이버트럭 단종 수순',
      '테슬라 사이버트럭 (종합) 로보택시 집중',
      '[2보] 테슬라 사이버트럭 판매 부진',
    ]);
    expect(result).toHaveLength(3);
    expect(result).toEqual(
      expect.arrayContaining(['테슬라 사이버트럭', '테슬라', '사이버트럭']),
    );
    expect(result.join(' ')).not.toMatch(/단독|속보|종합|2보/);
  });

  it('두 단어 조합은 등장 수가 같을 때 단어보다 앞선다', () => {
    expect(terms(['입동 추위 시작', '입동 추위 온다'])[0]).toBe('입동 추위');
  });

  it('등장 제목 수를 함께 돌려준다', () => {
    expect(
      service.extract(['환율 급등 충격', '환율 급등 여파', '환율 안정세']),
    ).toEqual([
      { term: '환율', articleCount: 3 },
      { term: '환율 급등', articleCount: 2 },
      { term: '급등', articleCount: 2 },
    ]);
  });

  it('따옴표·특수문자를 제거한다', () => {
    expect(terms(["'블루웨이브' 쇼크!", '"블루웨이브" 쇼크…'])[0]).toBe(
      '블루웨이브 쇼크',
    );
  });

  it('숫자만 있거나 숫자+단위인 토큰은 제외한다', () => {
    const result = terms([
      '2026 1,800만 4천800조원 10월',
      '2026 1,800만 4천800조원 10월',
    ]);
    expect(result).toEqual([]);
  });

  it('흔한 서술어는 제외하고 조합도 만들지 않는다', () => {
    expect(terms(['환율 발표 기록', '환율 발표 기록'])).toEqual(['환율']);
  });

  it('조사가 붙은 변형을 어간으로 합친다', () => {
    expect(terms(['테슬라가 공장 폐쇄', '테슬라는 내년 계획'])[0]).toBe(
      '테슬라',
    );
    expect(terms(['테슬라 신차', '테슬라의 공장'])[0]).toBe('테슬라');
  });

  it('조사처럼 보여도 어간이 없으면 원형을 유지한다', () => {
    expect(terms(['대구가 위험', '대구가 안전'])[0]).toBe('대구가');
  });

  it('제목 절반 이상에 나온 표현만 우선 고른다', () => {
    const result = service.extract([
      '금리 동결 결정',
      '금리 동결 유력',
      '금리 동결 전망',
      '물가 안정 신호',
      '물가 안정 흐름',
      '환율 불안 지속',
    ]);
    expect(result.every((t) => t.articleCount >= 3)).toBe(true);
  });

  it('절반 이상인 표현이 없으면 두 제목 이상에 나온 표현을 쓴다', () => {
    const result = terms([
      '금리 동결',
      '금리 인상',
      '물가 안정',
      '물가 불안',
      '환율 급등',
      '증시 하락',
    ]);
    expect(result).toEqual(['금리', '물가']);
  });

  it('공통 표현이 없으면 빈 목록이다', () => {
    expect(terms(['금리 동결', '물가 안정'])).toEqual([]);
  });

  it('최대 3개까지만 고른다', () => {
    expect(terms(['가나 다라 마바 사아', '가나 다라 마바 사아'])).toHaveLength(
      3,
    );
  });
});
