import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

// 네이버 뉴스 검색으로 수집한 기사. 본문은 수집하지 않는다
@Entity({ name: 'articles' })
@Index('uq_articles_url', ['url'], { unique: true })
export class Article {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string; // bigint 는 pg 드라이버가 string 으로 돌려준다

  // 정규화된 기사 URL
  @Column({ type: 'text' })
  url!: string;

  @Column({ type: 'text' })
  title!: string;

  // 네이버 검색 발췌문 (사실 추출 입력용). 최대 7일 보관 후 NULL 로 지운다 — 삭제 방식은 미정(CLAUDE.md)
  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'text' })
  publisher!: string;

  @Column({ name: 'published_at', type: 'timestamptz' })
  publishedAt!: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
