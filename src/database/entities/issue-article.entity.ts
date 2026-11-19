import { Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Article } from './article.entity';
import { Issue } from './issue.entity';

// 이슈에 묶인 기사 (N:M)
@Entity({ name: 'issue_articles' })
@Index('idx_issue_articles_article_id', ['articleId'])
export class IssueArticle {
  @PrimaryColumn({ name: 'issue_id', type: 'bigint' })
  issueId!: string;

  @PrimaryColumn({ name: 'article_id', type: 'bigint' })
  articleId!: string;

  @ManyToOne(() => Issue, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'issue_id' })
  issue!: Issue;

  @ManyToOne(() => Article, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'article_id' })
  article!: Article;
}
