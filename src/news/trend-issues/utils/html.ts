import { decode } from 'he';

// HTML 태그(<b> 등) 제거 → 엔티티(&quot; 등) 복원 → 공백 정리
export function stripHtml(value: string): string {
  return decode(value.replace(/<[^>]*>/g, ''))
    .replace(/\s+/g, ' ')
    .trim();
}
