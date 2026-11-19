import { stripHtml } from './html';

describe('stripHtml', () => {
  it('<b> 태그를 제거한다', () => {
    expect(stripHtml('한은 <b>기준금리</b> 동결')).toBe('한은 기준금리 동결');
  });

  it('HTML 엔티티를 복원한다', () => {
    expect(stripHtml('&quot;금리 인하&quot; 시사')).toBe('"금리 인하" 시사');
    expect(stripHtml('원&#39;달러 &amp; 엔화 &lt;급등&gt;')).toBe(
      "원'달러 & 엔화 <급등>",
    );
    expect(stripHtml('&#x27;환율&#x27;&nbsp;1400원')).toBe("'환율' 1400원");
  });

  it('공백을 정리한다', () => {
    expect(stripHtml('  부동산   <b>대책</b>\n발표 ')).toBe('부동산 대책 발표');
  });
});
