import { Module } from '@nestjs/common';
import { NewsModule } from '../news/news.module';
import { CollectRunService } from './collect-run.service';
import { RunsController } from './runs.controller';

@Module({
  imports: [NewsModule],
  controllers: [RunsController],
  providers: [CollectRunService],
})
export class RunsModule {}
