import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Article } from '../database/entities/article.entity';
import { CardArticle } from '../database/entities/card-article.entity';
import { Card } from '../database/entities/card.entity';
import { CardStoreService } from './card-store.service';

@Module({
  imports: [TypeOrmModule.forFeature([Card, Article, CardArticle])],
  providers: [CardStoreService],
  exports: [CardStoreService],
})
export class CardsModule {}
