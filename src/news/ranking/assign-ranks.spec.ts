import { assignRanks, RankableIssue } from './assign-ranks';

const OPTIONS = { cardsPerCategory: 4, overallTopN: 15 };

const issue = (
  id: string,
  category: string,
  score: number | null,
  publisherCount = 3,
): RankableIssue => ({ id, category, score, publisherCount });

describe('assignRanks', () => {
  it('카테고리 안에서 점수 내림차순, 동점이면 언론사 수 순이다', () => {
    const result = assignRanks(
      [
        issue('a', 'tech', 1),
        issue('b', 'tech', 3, 2),
        issue('c', 'tech', 3, 9),
      ],
      OPTIONS,
    );
    expect(result.map((i) => [i.id, i.categoryRank])).toEqual([
      ['c', 1],
      ['b', 2],
      ['a', 3],
    ]);
  });

  it('점수 없는 이슈는 뒤에 언론사 수 순으로 둔다', () => {
    const result = assignRanks(
      [
        issue('a', 'tech', null, 3),
        issue('b', 'tech', 0.1),
        issue('c', 'tech', null, 8),
      ],
      OPTIONS,
    );
    expect(result.map((i) => i.id)).toEqual(['b', 'c', 'a']);
  });

  it('카테고리 순위는 4위까지만 주고 나머지는 위치만 남긴다', () => {
    const result = assignRanks(
      Array.from({ length: 6 }, (_, i) => issue(`i${i}`, 'tech', 10 - i)),
      OPTIONS,
    );
    expect(result.map((i) => i.categoryRank)).toEqual([1, 2, 3, 4, null, null]);
    expect(result[5].categoryPosition).toBe(6);
  });

  it('랭킹은 카드 이슈(카테고리 4위 안) 안에서만 뽑는다', () => {
    // economy 5위(점수 50)는 전체에서 높아도 카드 이슈가 아니라 랭킹에 못 든다
    const economy = [100, 90, 80, 70, 50].map((s, i) =>
      issue(`e${i + 1}`, 'economy', s),
    );
    const result = assignRanks([...economy, issue('t1', 'tech', 60)], OPTIONS);

    const byId = new Map(result.map((i) => [i.id, i]));
    expect(byId.get('e5')).toMatchObject({
      categoryRank: null,
      overallRank: null,
    });
    expect(byId.get('t1')?.overallRank).toBe(5);
    expect(byId.get('e1')?.overallRank).toBe(1);
  });

  it('랭킹은 최대 15개이고 카테고리 순서를 유지해 돌려준다', () => {
    const categories = ['economy', 'tech', 'culture', 'society', 'environment'];
    const issues = categories.flatMap((category, c) =>
      Array.from({ length: 4 }, (_, i) =>
        issue(`${category}-${i}`, category, c * 10 + i),
      ),
    );

    const result = assignRanks(issues, OPTIONS);

    const ranked = result.filter((i) => i.overallRank !== null);
    expect(ranked).toHaveLength(15);
    expect(result.find((i) => i.overallRank === 1)?.id).toBe('environment-3');
    expect([...new Set(result.map((i) => i.category))]).toEqual(categories);
  });
});
