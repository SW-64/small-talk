import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { CardArticle } from './card-article.entity';

export const CARD_CATEGORIES = [
  'economy',
  'tech',
  'culture',
  'society',
  'environment',
] as const;
export type CardCategory = (typeof CARD_CATEGORIES)[number];

export const CARD_STATUSES = ['ok', 'failed'] as const;
export type CardStatus = (typeof CARD_STATUSES)[number];

// summary 한 줄. sourceIds 는 card_articles.source_no 를 가리킨다
export interface CardSummaryLine {
  text: string;
  sourceIds: number[];
}

const inList = (values: readonly string[]) =>
  values.map((v) => `'${v}'`).join(', ');

@Entity({ name: 'cards' })
@Index('uq_cards_date_category_rank', ['cardDate', 'category', 'issueRank'], {
  unique: true,
})
@Check('chk_cards_category', `"category" IN (${inList(CARD_CATEGORIES)})`)
@Check('chk_cards_status', `"status" IN (${inList(CARD_STATUSES)})`)
@Check(
  'chk_cards_ok_has_content',
  `"status" <> 'ok' OR ("summary" IS NOT NULL AND "smalltalk" IS NOT NULL)`,
)
@Check('chk_cards_window', `"window_start" < "window_end"`)
export class Card {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string; // bigint 는 pg 드라이버가 string 으로 돌려준다

  // 기준일(KST). 전날 06:00 ~ 이 날 06:00 수집분
  @Column({ name: 'card_date', type: 'date' })
  cardDate!: string;

  @Column({ type: 'text' })
  category!: CardCategory;

  @Column({ name: 'issue_rank', type: 'smallint' })
  issueRank!: number;

  // 대표 기사 제목 (representativeTitle)
  @Column({ type: 'text' })
  title!: string;

  @Column({ type: 'jsonb', nullable: true })
  summary!: CardSummaryLine[] | null;

  @Column({ type: 'jsonb', nullable: true })
  smalltalk!: string[] | null;

  @Column({ type: 'text' })
  status!: CardStatus;

  // 실패 사유 (apiError | invalidOutput | budgetExceeded) + 메시지
  @Column({ name: 'fail_reason', type: 'text', nullable: true })
  failReason!: string | null;

  @Column({ type: 'text' })
  model!: string;

  @Column({ name: 'article_count', type: 'int' })
  articleCount!: number;

  @Column({ name: 'publisher_count', type: 'int' })
  publisherCount!: number;

  @Column({ name: 'window_start', type: 'timestamptz' })
  windowStart!: Date;

  @Column({ name: 'window_end', type: 'timestamptz' })
  windowEnd!: Date;

  @Column({ name: 'regenerate_count', type: 'int', default: 0 })
  regenerateCount!: number;

  @Column({ name: 'generated_at', type: 'timestamptz' })
  generatedAt!: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @OneToMany(() => CardArticle, (ca) => ca.card)
  cardArticles!: CardArticle[];
}
