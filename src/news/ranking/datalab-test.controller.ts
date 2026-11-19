import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { DatalabTestRequestDto } from './dto/datalab-test-request.dto';
import { RankingService } from './ranking.service';

// 개발용: NODE_ENV=development 일 때만 AppModule 에 등록됨
@ApiTags('ranking (dev)')
@Controller('v1/dev/datalab-test')
export class DatalabTestController {
  constructor(private readonly ranking: RankingService) {}

  @Post()
  @HttpCode(200)
  run(@Body() { terms, ages, anchor }: DatalabTestRequestDto) {
    return this.ranking.testTerms(terms, { ages, anchor });
  }
}
