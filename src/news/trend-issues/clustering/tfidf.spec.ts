import {
  buildTfidfVectors,
  charNgrams,
  cosineSimilarity,
  preprocessTitle,
} from './tfidf';

describe('preprocessTitle', () => {
  it('앞쪽 말머리, 끝 말줄임, 공백·문장부호를 제거한다', () => {
    expect(preprocessTitle('[속보] 한은, 기준금리 동결...')).toBe(
      '한은기준금리동결',
    );
    expect(preprocessTitle('[단독][포토] 환율 1,450원 돌파…')).toBe(
      '환율1450원돌파',
    );
    expect(preprocessTitle('【경제】 Fed 금리 인하')).toBe('fed금리인하');
  });

  it('중간의 대괄호나 말줄임은 문장부호만 제거한다', () => {
    expect(preprocessTitle('환율…[종합] 급등')).toBe('환율종합급등');
  });
});

describe('charNgrams', () => {
  it('2~3글자 n-gram 빈도를 센다', () => {
    const grams = charNgrams('금리금리', [2, 3]);
    expect(grams.get('금리')).toBe(2);
    expect(grams.get('리금')).toBe(1);
    expect(grams.get('금리금')).toBe(1);
    expect(grams.get('리금리')).toBe(1);
  });

  it('n 보다 짧은 문자열은 해당 n-gram 이 없다', () => {
    expect(charNgrams('금', [2, 3]).size).toBe(0);
  });
});

describe('TF-IDF 코사인 유사도', () => {
  const texts = [
    '한은기준금리동결',
    '한은기준금리동결',
    '서울아파트값상승',
    '한은기준금리인하',
  ].map((t) => t);
  const vectors = buildTfidfVectors(texts, [2, 3]);

  it('벡터는 L2 정규화되어 자기 자신과의 유사도는 1', () => {
    expect(cosineSimilarity(vectors[0], vectors[0])).toBeCloseTo(1, 10);
  });

  it('동일 제목은 1, 겹치는 n-gram 이 없으면 0', () => {
    expect(cosineSimilarity(vectors[0], vectors[1])).toBeCloseTo(1, 10);
    expect(cosineSimilarity(vectors[0], vectors[2])).toBe(0);
  });

  it('비슷한 제목은 0 과 1 사이', () => {
    const sim = cosineSimilarity(vectors[0], vectors[3]);
    expect(sim).toBeGreaterThan(0.3);
    expect(sim).toBeLessThan(1);
  });

  it('대칭이다', () => {
    expect(cosineSimilarity(vectors[0], vectors[3])).toBeCloseTo(
      cosineSimilarity(vectors[3], vectors[0]),
      12,
    );
  });

  it('빈 문자열은 영벡터 (유사도 0)', () => {
    const [empty, other] = buildTfidfVectors(['', '금리'], [2, 3]);
    expect(empty.size).toBe(0);
    expect(cosineSimilarity(empty, other)).toBe(0);
  });
});
