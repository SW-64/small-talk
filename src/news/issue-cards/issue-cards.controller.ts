import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CardStoreService } from '../../cards/card-store.service';
import { IssueCardsRequestDto } from './dto/issue-cards-request.dto';
import { IssueCardsService } from './issue-cards.service';

// 개발용: NODE_ENV=development 일 때만 AppModule 에 등록됨
@ApiTags('issue-cards (dev)')
@Controller('v1/dev/issue-cards')
export class IssueCardsController {
  constructor(
    private readonly issueCards: IssueCardsService,
    private readonly cardStore: CardStoreService,
  ) {}

  @Post()
  @HttpCode(200)
  @ApiOperation({ summary: '카드 생성 (DB 저장 없음)' })
  run(@Body() options: IssueCardsRequestDto) {
    return this.issueCards.run(options);
  }

  @Post('save')
  @HttpCode(200)
  @ApiOperation({
    summary: '카드 생성 후 DB 저장',
    description:
      '같은 기준일·카테고리의 기존 카드는 지우고 새로 저장한다. 응답에 저장 요약(saved)과 생성 결과(result)를 함께 돌려준다',
  })
  async runAndSave(@Body() options: IssueCardsRequestDto) {
    const result = await this.issueCards.run(options);
    const saved = await this.cardStore.save(result);
    return { saved, result };
  }
}
