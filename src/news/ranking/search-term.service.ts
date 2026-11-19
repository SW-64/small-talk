import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { rankingConfig } from '../../config/ranking.config';
import { SearchTerm } from './ranking.types';

const LEADING_BRACKETS = /^(?:\s*(?:\[[^\]]*\]|【[^】]*】|<[^>]*>))+/u;
// 숫자만, 또는 숫자+단위 (800만, 4천800조원, 10월, 3명, 6%)
const NUMERIC_TOKEN =
  /^\d[\d만억조천백]*(?:[%원명건개년월일시분초위배세차회]|달러|퍼센트)?$/u;

interface Candidate {
  term: string;
  isPair: boolean;
  titles: Set<number>;
  firstSeen: number;
}

/**
 * 이슈 제목들에서 대표 검색어를 규칙으로 뽑는다 (AI 미사용).
 * 공통으로 많이 등장하는 단어·인접한 두 단어 조합 중 제목 절반 이상에 나온 표현을 우선한다.
 */
@Injectable()
export class SearchTermService {
  private readonly stopwords: Set<string>;
  private readonly inlineLabels: RegExp;

  constructor(
    @Inject(rankingConfig.KEY)
    private readonly config: ConfigType<typeof rankingConfig>,
  ) {
    const { stopwords, headlineLabels } = config.searchTerms;
    this.stopwords = new Set(stopwords);
    const labels = ['\\d+보', '종합\\d*보?', ...headlineLabels].join('|');
    this.inlineLabels = new RegExp(
      `[\\[(（【<]\\s*(?:${labels})\\s*[\\])）】>]`,
      'gu',
    );
  }

  extract(titles: string[]): SearchTerm[] {
    const { maxTerms, minCoverage } = this.config.searchTerms;
    const tokenized = titles.map((title) => this.tokenize(title));
    const canonical = this.buildCanonicalizer(tokenized.flat());
    const candidates = this.collectCandidates(tokenized, canonical);

    const minTitles = Math.min(2, titles.length);
    const frequent = candidates.filter((c) => c.titles.size >= minTitles);
    const covered = frequent.filter(
      (c) => c.titles.size / titles.length >= minCoverage,
    );

    return (covered.length > 0 ? covered : frequent)
      .sort(
        (a, b) =>
          b.titles.size - a.titles.size ||
          Number(b.isPair) - Number(a.isPair) ||
          a.firstSeen - b.firstSeen,
      )
      .slice(0, maxTerms)
      .map(({ term, titles: seen }) => ({ term, articleCount: seen.size }));
  }

  private tokenize(title: string): string[] {
    return title
      .replace(LEADING_BRACKETS, '')
      .replace(this.inlineLabels, ' ')
      .replace(/[^\p{L}\p{N}]/gu, ' ')
      .split(/\s+/)
      .filter(Boolean);
  }

  // 조사를 뗀 형태가 실제로 묶음 안에 있거나, 여러 변형이 같은 어간을 공유할 때만 합친다
  private buildCanonicalizer(tokens: string[]): (token: string) => string {
    const known = new Set(tokens);
    const variants = new Map<string, Set<string>>();
    for (const token of known) {
      const stem = this.stemOf(token);
      if (!stem) continue;
      if (!variants.has(stem)) variants.set(stem, new Set());
      variants.get(stem)!.add(token);
    }
    return (token) => {
      const stem = this.stemOf(token);
      if (stem && (known.has(stem) || variants.get(stem)!.size >= 2)) {
        return stem;
      }
      return token;
    };
  }

  private stemOf(token: string): string | null {
    for (const particle of this.config.searchTerms.particles) {
      if (!token.endsWith(particle)) continue;
      const stem = token.slice(0, -particle.length);
      if ([...stem].length >= 2) return stem;
    }
    return null;
  }

  private isValid(token: string): boolean {
    return (
      [...token].length >= 2 &&
      !NUMERIC_TOKEN.test(token) &&
      !this.stopwords.has(token)
    );
  }

  private collectCandidates(
    tokenized: string[][],
    canonical: (token: string) => string,
  ): Candidate[] {
    const candidates = new Map<string, Candidate>();
    let order = 0;

    const add = (term: string, isPair: boolean, titleIndex: number) => {
      const key = term.toLowerCase();
      const existing = candidates.get(key);
      if (existing) existing.titles.add(titleIndex);
      else {
        candidates.set(key, {
          term,
          isPair,
          titles: new Set([titleIndex]),
          firstSeen: order++,
        });
      }
    };

    tokenized.forEach((tokens, titleIndex) => {
      const words = tokens.map(canonical);
      words.forEach((word, i) => {
        if (!this.isValid(word)) return;
        add(word, false, titleIndex);
        const next = words[i + 1];
        if (next !== undefined && this.isValid(next)) {
          add(`${word} ${next}`, true, titleIndex);
        }
      });
    });
    return [...candidates.values()];
  }
}
