import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CollectRunService } from './collect-run.service';
import { CollectRunRequestDto } from './dto/collect-run-request.dto';

// 개발용: NODE_ENV=development 일 때만 AppModule 에 등록됨 (스케줄러 방식 결정 전 수동 실행용)
@ApiTags('runs (dev)')
@Controller('v1/dev/runs')
export class RunsController {
  constructor(private readonly collectRun: CollectRunService) {}

  @Post('collect')
  @HttpCode(200)
  @ApiOperation({
    summary: '② 수집 + 랭킹 실행 후 DB 저장',
    description:
      'daily_runs / articles / issues / issue_articles 에 저장한다. 같은 날짜가 있으면 409, force: true 면 교체',
  })
  collect(@Body() options: CollectRunRequestDto) {
    return this.collectRun.collect(options);
  }
}
