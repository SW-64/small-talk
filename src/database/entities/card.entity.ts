import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { CARD_STATUSES, inList } from './constants';
import type { CardStatus } from './constants';
import { Issue } from './issue.entity';

// 이슈 1개당 카드 1개(uq_cards_issue_id 로 보장). 카테고리 카드와 랭킹 카드가 같은 이슈면 같은 카드를 쓴다
@Entity({ name: 'cards' })
@Index('uq_cards_issue_id', ['issueId'], { unique: true })
@Check('chk_cards_status', `"status" IN (${inList(CARD_STATUSES)})`)
@Check(
  'chk_cards_ok_has_content',
  `"status" <> 'ok' OR (` +
    `"summary" IS NOT NULL AND jsonb_array_length("summary") BETWEEN 1 AND 3 AND ` +
    `"expressions" IS NOT NULL AND jsonb_array_length("expressions") = 4)`,
)
export class Card {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'issue_id', type: 'bigint' })
  issueId!: string;

  // 3줄 요약 (한 줄 40자 안쪽)
  @Column({ type: 'jsonb', nullable: true })
  summary!: string[] | null;

  // 스몰토크 표현 4개 (0번이 기본 표현)
  @Column({ type: 'jsonb', nullable: true })
  expressions!: string[] | null;

  @Column({ type: 'text' })
  status!: CardStatus;

  @Column({ name: 'fail_reason', type: 'text', nullable: true })
  failReason!: string | null;

  @Column({ type: 'text' })
  model!: string;

  @Column({ name: 'generated_at', type: 'timestamptz' })
  generatedAt!: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @ManyToOne(() => Issue, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'issue_id' })
  issue!: Issue;
}
