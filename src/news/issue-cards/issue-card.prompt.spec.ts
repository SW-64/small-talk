import {
  buildBatchPrompt,
  InvalidCardOutputError,
  parseBatchContent,
  parseCardContent,
  pickArticles,
  PromptArticle,
} from './issue-card.prompt';

const OPTIONS = { summaryLines: 3, smalltalkCount: 3 };

const article = (publisher: string, title = publisher): PromptArticle => ({
  title,
  description: '',
  url: `https://${publisher}/${title}`,
  publisher,
  publishedAt: '2026-11-16T10:00:00+09:00',
  sources: [],
});

const valid = () => ({
  summary: [
    { text: ' 첫 줄 ', articleIds: [1, 2] },
    { text: '둘째 줄', articleIds: [2] },
    { text: '셋째 줄', articleIds: [3] },
  ],
  smalltalk: ['a', 'b', 'c'],
});

describe('pickArticles', () => {
  it('언론사가 겹치지 않는 기사를 먼저 고른다', () => {
    const picked = pickArticles(
      [article('a', '1'), article('a', '2'), article('b', '3')],
      2,
    );
    expect(picked.map((a) => a.title)).toEqual(['1', '3']);
  });

  it('자리가 남으면 중복 언론사 기사로 채운다', () => {
    const picked = pickArticles(
      [article('a', '1'), article('a', '2'), article('b', '3')],
      5,
    );
    expect(picked.map((a) => a.title)).toEqual(['1', '3', '2']);
  });
});

describe('parseCardContent', () => {
  it('정상 응답을 다듬어 돌려준다', () => {
    const result = parseCardContent(valid(), 3, OPTIONS);
    expect(result.summary[0]).toEqual({ text: '첫 줄', articleIds: [1, 2] });
    expect(result.smalltalk).toEqual(['a', 'b', 'c']);
  });

  it('범위를 벗어난 기사 번호는 버리고 중복은 합친다', () => {
    const value = valid();
    value.summary[0].articleIds = [0, 1, 1, 9];
    expect(parseCardContent(value, 3, OPTIONS).summary[0].articleIds).toEqual([
      1,
    ]);
  });

  it('유효한 근거 기사가 없으면 오류', () => {
    const value = valid();
    value.summary[1].articleIds = [7];
    expect(() => parseCardContent(value, 3, OPTIONS)).toThrow(
      InvalidCardOutputError,
    );
  });

  it('줄 수·개수가 맞지 않으면 오류', () => {
    const fewer = { ...valid(), smalltalk: ['a'] };
    expect(() => parseCardContent(fewer, 3, OPTIONS)).toThrow(
      InvalidCardOutputError,
    );
    expect(() => parseCardContent({}, 3, OPTIONS)).toThrow(
      InvalidCardOutputError,
    );
  });
});

describe('parseBatchContent', () => {
  const issues = [
    { id: 'I1', articleCount: 3 },
    { id: 'I2', articleCount: 3 },
    { id: 'I3', articleCount: 3 },
  ];

  it('이슈별로 나누고, 잘못되거나 빠진 카드는 그 이슈만 오류로 표시한다', () => {
    const bad = { ...valid(), smalltalk: ['a'] };
    const result = parseBatchContent(
      {
        cards: [
          { issueId: 'I1', ...valid() },
          { issueId: 'I2', ...bad },
        ],
      },
      issues,
      OPTIONS,
    );
    expect(result.get('I1')).toMatchObject({ smalltalk: ['a', 'b', 'c'] });
    expect(result.get('I2')).toBeInstanceOf(InvalidCardOutputError);
    expect(result.get('I3')).toBeInstanceOf(InvalidCardOutputError);
  });

  it('cards 배열이 없으면 전체 오류', () => {
    expect(() => parseBatchContent({}, issues, OPTIONS)).toThrow(
      InvalidCardOutputError,
    );
  });
});

describe('buildBatchPrompt', () => {
  it('이슈마다 id 와 이슈 안 기사 번호를 붙인다', () => {
    const prompt = buildBatchPrompt([
      {
        id: 'I1',
        category: 'economy',
        issue: {
          rank: 1,
          representativeTitle: '대표',
          publisherCount: 2,
          articleCount: 2,
          articles: [],
        },
        articles: [article('a', '첫 기사'), article('b', '둘째 기사')],
      },
      {
        id: 'I2',
        category: 'tech',
        issue: {
          rank: 1,
          representativeTitle: '대표2',
          publisherCount: 1,
          articleCount: 1,
          articles: [],
        },
        articles: [article('c', '셋째 기사')],
      },
    ]);
    expect(prompt).toContain('=== 이슈 I1 ===');
    expect(prompt).toContain('=== 이슈 I2 ===');
    expect(prompt).toMatch(/\[2\] \(b,[^\n]*\n제목: 둘째 기사/);
    expect(prompt).toMatch(/\[1\] \(c,[^\n]*\n제목: 셋째 기사/);
  });
});
