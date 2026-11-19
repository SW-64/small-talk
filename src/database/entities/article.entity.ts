import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { CardArticle } from './card-article.entity';

@Entity({ name: 'articles' })
@Index('uq_articles_url', ['url'], { unique: true })
export class Article {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  // 정규화된 기사 URL (trend-issues 에서 정리된 값)
  @Column({ type: 'text' })
  url!: string;

  @Column({ type: 'text' })
  title!: string;

  // 네이버 검색 발췌문 (재생성 입력용)
  @Column({ type: 'text' })
  description!: string;

  @Column({ type: 'text' })
  publisher!: string;

  @Column({ name: 'published_at', type: 'timestamptz' })
  publishedAt!: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @OneToMany(() => CardArticle, (ca) => ca.article)
  cardArticles!: CardArticle[];
}
