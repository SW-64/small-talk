import { WordMatch } from './trend-issues.types';

// 제목에 단어가 포함된(부분 문자열) 기사 수를 단어별로 센다. 많이 나온 단어 순
export function matchWords(titles: string[], words: string[]): WordMatch[] {
  return words
    .map((word) => ({
      word,
      articleCount: titles.filter((title) => title.includes(word)).length,
    }))
    .filter((match) => match.articleCount > 0)
    .sort((a, b) => b.articleCount - a.articleCount);
}
