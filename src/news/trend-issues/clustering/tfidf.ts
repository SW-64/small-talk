export type SparseVector = Map<string, number>;

/**
 * 묶기용 제목 전처리
 * - 앞쪽 말머리([속보], [단독], 【포토】 등) 제거
 * - 끝의 말줄임(... / …) 제거: 잘린 제목의 꼬리 n-gram 이 노이즈가 되지 않게
 * - 문자·숫자 외(공백·문장부호) 제거 후 소문자화 — 띄어쓰기 차이를 무시
 */
export function preprocessTitle(title: string): string {
  return title
    .trim()
    .replace(/^(?:\s*(?:\[[^\]]*\]|【[^】]*】|<[^>]*>))+/u, '')
    .replace(/(?:\.{2,}|…)+\s*$/u, '')
    .replace(/[^\p{L}\p{N}]/gu, '')
    .toLowerCase();
}

export function charNgrams(text: string, sizes: number[]): Map<string, number> {
  const counts = new Map<string, number>();
  const chars = [...text];
  for (const n of sizes) {
    for (let i = 0; i + n <= chars.length; i++) {
      const gram = chars.slice(i, i + n).join('');
      counts.set(gram, (counts.get(gram) ?? 0) + 1);
    }
  }
  return counts;
}

/**
 * 문자 n-gram TF-IDF 벡터 (L2 정규화)
 * TF = 문서 내 빈도, IDF = ln((1 + N) / (1 + df)) + 1 (smooth idf)
 */
export function buildTfidfVectors(
  texts: string[],
  sizes: number[],
): SparseVector[] {
  const termCounts = texts.map((text) => charNgrams(text, sizes));

  const df = new Map<string, number>();
  for (const counts of termCounts) {
    for (const term of counts.keys()) df.set(term, (df.get(term) ?? 0) + 1);
  }

  const n = texts.length;
  return termCounts.map((counts) => {
    const vector: SparseVector = new Map();
    let norm = 0;
    for (const [term, tf] of counts) {
      const weight = tf * (Math.log((1 + n) / (1 + df.get(term)!)) + 1);
      vector.set(term, weight);
      norm += weight * weight;
    }
    norm = Math.sqrt(norm);
    if (norm > 0) {
      for (const [term, weight] of vector) vector.set(term, weight / norm);
    }
    return vector;
  });
}

// L2 정규화된 벡터끼리의 코사인 유사도 = 내적
export function cosineSimilarity(a: SparseVector, b: SparseVector): number {
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  let dot = 0;
  for (const [term, weight] of small) {
    const other = large.get(term);
    if (other !== undefined) dot += weight * other;
  }
  return dot;
}
