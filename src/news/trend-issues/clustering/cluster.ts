import { buildTfidfVectors, preprocessTitle } from './tfidf';
import { UnionFind } from './union-find';

export interface ClusterOptions {
  ngramSizes: number[];
  similarityThreshold: number;
}

/**
 * [3] 묶기: 제목 문자 n-gram TF-IDF 코사인 유사도가 기준값 이상인 쌍을 연결하고
 * Union-Find 로 묶음(제목 인덱스 목록)을 만든다.
 * n-gram 역색인으로 겹치는 n-gram 이 있는 쌍만 내적을 계산한다.
 */
export function clusterTitles(
  titles: string[],
  { ngramSizes, similarityThreshold }: ClusterOptions,
): number[][] {
  const vectors = buildTfidfVectors(titles.map(preprocessTitle), ngramSizes);

  const postings = new Map<string, { doc: number; weight: number }[]>();
  vectors.forEach((vector, doc) => {
    for (const [term, weight] of vector) {
      const list = postings.get(term);
      if (list) list.push({ doc, weight });
      else postings.set(term, [{ doc, weight }]);
    }
  });

  const uf = new UnionFind(titles.length);
  vectors.forEach((vector, i) => {
    const dots = new Map<number, number>();
    for (const [term, weight] of vector) {
      for (const { doc: j, weight: other } of postings.get(term)!) {
        if (j > i) dots.set(j, (dots.get(j) ?? 0) + weight * other);
      }
    }
    for (const [j, dot] of dots) {
      // 부동소수 오차로 동일 제목이 0.9999… 가 되는 경우를 감안
      if (dot >= similarityThreshold - 1e-9) uf.union(i, j);
    }
  });

  return uf.groups();
}
