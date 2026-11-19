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
import { CATEGORIES, inList, REVIEW_STATUSES } from './constants';
import type { Category, ReviewStatus } from './constants';
import { DailyRun } from './daily-run.entity';

export interface IssueSearchTerm {
  term: string;
  articleCount: number;
}

// 하루 실행에서 뽑은 이슈(기사 묶음).
// category_rank 1 = Today Pick, 2~4 = 예비 이슈 / overall_rank 1~10 = 랭킹 TOP 10, 11~15 = 랭킹 예비
@Entity({ name: 'issues' })
@Index('idx_issues_run_date', ['runDate'])
@Index('uq_issues_run_category_rank', ['runDate', 'category', 'categoryRank'], {
  unique: true,
})
@Index('uq_issues_run_overall_rank', ['runDate', 'overallRank'], {
  unique: true,
})
@Check('chk_issues_category', `"category" IN (${inList(CATEGORIES)})`)
@Check(
  'chk_issues_review_status',
  `"review_status" IN (${inList(REVIEW_STATUSES)})`,
)
@Check(
  'chk_issues_category_rank',
  `"category_rank" IS NULL OR "category_rank" BETWEEN 1 AND 4`,
)
@Check(
  'chk_issues_overall_rank',
  `"overall_rank" IS NULL OR "overall_rank" BETWEEN 1 AND 15`,
)
export class Issue {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'run_date', type: 'date' })
  runDate!: string;

  // AI 가 분류하고 07시 검수에서 확인한 카테고리
  @Column({ type: 'text' })
  category!: Category;

  @Column({ name: 'representative_title', type: 'text' })
  representativeTitle!: string;

  // 데이터랩 조회에 쓴 검색어
  @Column({ name: 'search_terms', type: 'jsonb' })
  searchTerms!: IssueSearchTerm[];

  // 순위 산정 점수. 산정 방식은 ② 단계에서 결정. 조회 실패 시 NULL
  @Column({ name: 'search_score', type: 'double precision', nullable: true })
  searchScore!: number | null;

  @Column({ name: 'category_rank', type: 'smallint', nullable: true })
  categoryRank!: number | null;

  @Column({ name: 'overall_rank', type: 'smallint', nullable: true })
  overallRank!: number | null;

  // AI 가 새로 쓴 랭킹 헤드라인 (검수 승인된 것만 노출)
  @Column({ type: 'text', nullable: true })
  headline!: string | null;

  @Column({ name: 'review_status', type: 'text', default: 'pending' })
  reviewStatus!: ReviewStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @ManyToOne(() => DailyRun, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'run_date' })
  run!: DailyRun;
}
