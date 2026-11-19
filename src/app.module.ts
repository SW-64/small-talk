import 'dotenv/config';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import {
  appConfig,
  corsConfig,
  databaseConfig,
  naverConfig,
  swaggerConfig,
} from './config/configuration';
import { issueCardsConfig } from './config/issue-cards.config';
import { envValidationSchema } from './config/env.validation';
import { rankingConfig } from './config/ranking.config';
import { trendIssuesConfig } from './config/trend-issues.config';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { NewsModule } from './news/news.module';
import { RunsModule } from './runs/runs.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema,
      load: [
        appConfig,
        databaseConfig,
        corsConfig,
        swaggerConfig,
        naverConfig,
        trendIssuesConfig,
        rankingConfig,
        issueCardsConfig,
      ],
    }),
    DatabaseModule,
    HealthModule,
    // 개발용 엔드포인트(GET /api/news/sample, POST /api/v1/dev/trend-issues, POST /api/v1/dev/datalab-test,
    // POST /api/v1/dev/issue-cards, POST /api/v1/dev/runs/collect)
    // — NODE_ENV=development 에서만 등록, 운영에서는 라우트 자체가 없음.
    // RunsModule 은 스케줄러 방식이 정해지면 운영 등록 방식을 다시 정한다
    ...(process.env.NODE_ENV === 'development' ? [NewsModule, RunsModule] : []),
  ],
})
export class AppModule {}
