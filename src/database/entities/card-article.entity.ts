import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { Article } from './article.entity';
import { Card } from './card.entity';

// 카드의 관련 기사(최대 3건). position 은 승인 사실이 많은 순(같으면 최신 발행 순)
@Entity({ name: 'card_articles' })
@Index('uq_card_articles_card_position', ['cardId', 'position'], {
  unique: true,
})
@Index('idx_card_articles_article_id', ['articleId'])
@Check('chk_card_articles_position', `"position" BETWEEN 1 AND 3`)
export class CardArticle {
  @PrimaryColumn({ name: 'card_id', type: 'bigint' })
  cardId!: string;

  @PrimaryColumn({ name: 'article_id', type: 'bigint' })
  articleId!: string;

  @Column({ type: 'smallint' })
  position!: number;

  @ManyToOne(() => Card, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'card_id' })
  card!: Card;

  @ManyToOne(() => Article, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'article_id' })
  article!: Article;
}
