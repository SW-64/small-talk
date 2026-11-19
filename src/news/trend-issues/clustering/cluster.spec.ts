import { clusterTitles } from './cluster';

const OPTIONS = { ngramSizes: [2, 3], similarityThreshold: 0.5 };

const titleGroups = (titles: string[], options = OPTIONS) =>
  clusterTitles(titles, options).map((group) => group.map((i) => titles[i]));

describe('clusterTitles', () => {
  const titles = [
    '한은, 기준금리 연 2.50% 동결…3연속 동결',
    '[속보] 한은, 기준금리 연 2.50% 동결',
    '한은 기준금리 연 2.50%로 동결…3연속 동결 결정',
    '한은, 기준금리 연 2.50% 동결…3연속 동결 … 가계부채 부담에...', // 잘린 제목
    '원·달러 환율 1,450원 돌파…16년 만에 최고',
    '[종합] 원·달러 환율 1450원 돌파, 16년 만에 최고치',
    '서울 아파트값 상승폭 확대…강남3구가 주도',
  ];

  it('같은 사건(말머리, 말줄임 잘림 포함)은 한 묶음으로', () => {
    const groups = titleGroups(titles);
    expect(groups).toContainEqual([titles[0], titles[1], titles[2], titles[3]]);
    expect(groups).toContainEqual([titles[4], titles[5]]);
  });

  it('다른 사건은 분리된다', () => {
    const groups = titleGroups(titles);
    expect(groups).toContainEqual([titles[6]]);
    expect(groups).toHaveLength(3);
  });

  it('기준값이 1 보다 크면 아무것도 묶이지 않는다', () => {
    const groups = clusterTitles(titles, {
      ...OPTIONS,
      similarityThreshold: 1.01,
    });
    expect(groups).toHaveLength(titles.length);
  });

  it('완전히 같은 제목은 기준값 1 에서도 묶인다', () => {
    const groups = clusterTitles(['환율 급등', '환율 급등', '금리 동결'], {
      ...OPTIONS,
      similarityThreshold: 1,
    });
    expect(groups).toEqual([[0, 1], [2]]);
  });

  it('빈 입력은 빈 결과', () => {
    expect(clusterTitles([], OPTIONS)).toEqual([]);
  });
});
