import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { IssueCardsRequestDto } from './dto/issue-cards-request.dto';
import { IssueCardsService } from './issue-cards.service';

// 개발용: NODE_ENV=development 일 때만 AppModule 에 등록됨
@ApiTags('issue-cards (dev)')
@Controller('v1/dev/issue-cards')
export class IssueCardsController {
  constructor(private readonly issueCards: IssueCardsService) {}

  @Post()
  @HttpCode(200)
  @ApiOperation({ summary: '카드 생성 (DB 저장 없음)' })
  run(@Body() options: IssueCardsRequestDto) {
    return this.issueCards.run(options);
  }
}
