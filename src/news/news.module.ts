import { Module } from '@nestjs/common';
import { CardsModule } from '../cards/cards.module';
import { GeminiClient } from './issue-cards/gemini.client';
import { IssueCardsController } from './issue-cards/issue-cards.controller';
import { IssueCardsService } from './issue-cards/issue-cards.service';
import { NaverNewsClient } from './naver/naver-news.client';
import { NewsController } from './news.controller';
import { NewsService } from './news.service';
import { RankingModule } from './ranking/ranking.module';
import { CollectService } from './trend-issues/collect.service';
import { TrendIssuesController } from './trend-issues/trend-issues.controller';
import { TrendIssuesService } from './trend-issues/trend-issues.service';

@Module({
  imports: [RankingModule, CardsModule],
  controllers: [NewsController, TrendIssuesController, IssueCardsController],
  providers: [
    NaverNewsClient,
    NewsService,
    CollectService,
    TrendIssuesService,
    GeminiClient,
    IssueCardsService,
  ],
})
export class NewsModule {}
