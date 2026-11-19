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
import { Article } from './article.entity';
import { inList, REVIEW_STATUSES } from './constants';
import type { ReviewStatus } from './constants';
import { Issue } from './issue.entity';

// AI 가 발췌문에서 뽑은 사실 후보. 사람이 검수해 approved 인 것만 요약·스몰토크 생성에 쓴다
@Entity({ name: 'facts' })
@Index('idx_facts_issue_id', ['issueId'])
@Index('idx_facts_article_id', ['articleId'])
@Check('chk_facts_status', `"status" IN (${inList(REVIEW_STATUSES)})`)
export class Fact {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'issue_id', type: 'bigint' })
  issueId!: string;

  // 이 사실의 출처 기사 (관련 기사 목록 구성에 사용)
  @Column({ name: 'article_id', type: 'bigint' })
  articleId!: string;

  @Column({ name: 'ai_text', type: 'text' })
  aiText!: string;

  // 검수자가 수정한 문장. NULL 이면 ai_text 를 그대로 승인한 것
  @Column({ name: 'reviewed_text', type: 'text', nullable: true })
  reviewedText!: string | null;

  @Column({ type: 'text', default: 'pending' })
  status!: ReviewStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @ManyToOne(() => Issue, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'issue_id' })
  issue!: Issue;

  @ManyToOne(() => Article, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'article_id' })
  article!: Article;
}
