import { OmitType } from '@nestjs/swagger';
import { TrendIssuesRequestDto } from '../../trend-issues/dto/trend-issues-request.dto';

// trend-issues 요청과 같되 랭킹 옵션은 받지 않는다 (카드 생성은 랭킹 제외)
export class IssueCardsRequestDto extends OmitType(TrendIssuesRequestDto, [
  'ranking',
] as const) {}
