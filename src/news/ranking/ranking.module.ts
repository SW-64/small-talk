import { Module } from '@nestjs/common';
import { DatalabTestController } from './datalab-test.controller';
import { DatalabClient } from './datalab.client';
import { RankingService } from './ranking.service';
import { SearchTermService } from './search-term.service';

@Module({
  controllers: [DatalabTestController],
  providers: [DatalabClient, SearchTermService, RankingService],
  exports: [RankingService],
})
export class RankingModule {}
