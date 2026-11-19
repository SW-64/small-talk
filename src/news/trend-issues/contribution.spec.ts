import { computeContributions } from './contribution';
import { IssueCluster } from './trend-issues.types';

const issue = (...keywords: string[]) => ({ keywords }) as IssueCluster;

describe('computeContributions', () => {
  const result = computeContributions([
    issue('환율'),
    issue('환율', '기준금리'),
    issue('반도체'),
  ]);

  it('키워드가 포함된 상위 이슈 수를 센다', () => {
    expect(result.get('환율')?.topIssues).toBe(2);
    expect(result.get('기준금리')?.topIssues).toBe(1);
  });

  it('그 키워드로만 구성된 이슈만 단독 기여로 센다', () => {
    expect(result.get('환율')?.soloTopIssues).toBe(1);
    expect(result.get('기준금리')?.soloTopIssues).toBe(0);
    expect(result.get('반도체')?.soloTopIssues).toBe(1);
  });

  it('상위 이슈에 없는 키워드는 결과에 없다', () => {
    expect(result.has('부동산')).toBe(false);
  });
});
