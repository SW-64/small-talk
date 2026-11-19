import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { inList, RUN_STATUSES } from './constants';
import type { RunStatus } from './constants';

// 하루치 콘텐츠 실행 단위. published_at 이 있어야 사용자에게 노출한다 (08시 전에는 전날 실행분 노출)
@Entity({ name: 'daily_runs' })
@Check('chk_daily_runs_status', `"status" IN (${inList(RUN_STATUSES)})`)
@Check('chk_daily_runs_window', `"window_start" < "window_end"`)
export class DailyRun {
  // 기준일(KST). 전날 06:00 ~ 이 날 06:00 수집분
  @PrimaryColumn({ name: 'run_date', type: 'date' })
  runDate!: string;

  @Column({ type: 'text' })
  status!: RunStatus;

  @Column({ name: 'window_start', type: 'timestamptz' })
  windowStart!: Date;

  @Column({ name: 'window_end', type: 'timestamptz' })
  windowEnd!: Date;

  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
