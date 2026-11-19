import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { TrendIssuesRequestDto } from './dto/trend-issues-request.dto';
import { TrendIssuesService } from './trend-issues.service';

// 개발용: NODE_ENV=development 일 때만 AppModule 에 등록됨
@ApiTags('trend-issues (dev)')
@Controller('v1/dev/trend-issues')
export class TrendIssuesController {
  constructor(private readonly trendIssues: TrendIssuesService) {}

  @Post()
  @HttpCode(200)
  run(@Body() options: TrendIssuesRequestDto) {
    return this.trendIssues.run(options);
  }
}
