import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { NewsService } from './news.service';

// 개발용: NODE_ENV=development 일 때만 AppModule 에 등록됨
@ApiTags('news (dev)')
@Controller('news')
export class NewsController {
  constructor(private readonly newsService: NewsService) {}

  @Get('sample')
  @ApiOperation({
    summary: '카테고리별 최신 기사 1건씩 수집 → Gemini 로 3줄 요약 + 스몰토크',
  })
  sample() {
    return this.newsService.sampleCards();
  }
}
