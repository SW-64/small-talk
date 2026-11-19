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

// 카드가 인용한 기사. source_no 는 카드 안 기사 번호(1부터)이며 cards.summary[].sourceIds 가 가리킨다
@Entity({ name: 'card_articles' })
@Index('uq_card_articles_card_source_no', ['cardId', 'sourceNo'], {
  unique: true,
})
@Index('idx_card_articles_article_id', ['articleId'])
@Check('chk_card_articles_source_no', `"source_no" >= 1`)
export class CardArticle {
  @PrimaryColumn({ name: 'card_id', type: 'bigint' })
  cardId!: string;

  @PrimaryColumn({ name: 'article_id', type: 'bigint' })
  articleId!: string;

  @Column({ name: 'source_no', type: 'smallint' })
  sourceNo!: number;

  @ManyToOne(() => Card, (card) => card.cardArticles, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'card_id' })
  card!: Card;

  @ManyToOne(() => Article, (article) => article.cardArticles, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'article_id' })
  article!: Article;
}
