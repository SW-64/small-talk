export const CATEGORIES = [
  'economy',
  'tech',
  'culture',
  'society',
  'environment',
] as const;
export type Category = (typeof CATEGORIES)[number];

// 하루 파이프라인 진행 상태 (06시 수집 → 07시 검수 → 08시 오픈)
export const RUN_STATUSES = [
  'collecting',
  'extracted',
  'reviewing',
  'generated',
  'published',
] as const;
export type RunStatus = (typeof RUN_STATUSES)[number];

// 이슈(헤드라인)·사실의 사람 검수 상태
export const REVIEW_STATUSES = ['pending', 'approved', 'rejected'] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export const CARD_STATUSES = ['ok', 'failed'] as const;
export type CardStatus = (typeof CARD_STATUSES)[number];

// CHECK 제약용 IN 목록
export const inList = (values: readonly string[]) =>
  values.map((v) => `'${v}'`).join(', ');
