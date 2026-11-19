import { UnionFind } from './union-find';

describe('UnionFind', () => {
  it('처음에는 모두 각자의 묶음', () => {
    const uf = new UnionFind(3);
    expect(uf.groups()).toEqual([[0], [1], [2]]);
    expect(uf.find(2)).toBe(2);
  });

  it('union 한 원소는 같은 root 를 가진다', () => {
    const uf = new UnionFind(4);
    expect(uf.union(0, 1)).toBe(true);
    expect(uf.find(0)).toBe(uf.find(1));
    expect(uf.find(0)).not.toBe(uf.find(2));
  });

  it('이미 같은 묶음이면 union 은 false', () => {
    const uf = new UnionFind(2);
    uf.union(0, 1);
    expect(uf.union(1, 0)).toBe(false);
  });

  it('연결은 이행적이다 (0-1, 1-2 → 0,1,2 한 묶음)', () => {
    const uf = new UnionFind(5);
    uf.union(0, 1);
    uf.union(1, 2);
    uf.union(3, 4);
    expect(uf.find(0)).toBe(uf.find(2));
    expect(uf.groups()).toEqual([
      [0, 1, 2],
      [3, 4],
    ]);
  });

  it('긴 체인도 하나로 묶이고 경로 압축 후에도 결과가 같다', () => {
    const n = 1000;
    const uf = new UnionFind(n);
    for (let i = 1; i < n; i++) uf.union(i - 1, i);
    const root = uf.find(n - 1);
    for (let i = 0; i < n; i++) expect(uf.find(i)).toBe(root);
    expect(uf.groups()).toHaveLength(1);
  });
});
