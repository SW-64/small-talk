import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, Matches } from 'class-validator';

export class CollectRunRequestDto {
  @ApiPropertyOptional({
    description:
      '기준 "당일"(KST, YYYY-MM-DD). 수집 기간은 전날 06:00 ~ 이 날 06:00. 생략하면 가장 최근에 끝난 06:00 기준',
    example: '2026-11-19',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'date 는 YYYY-MM-DD 형식이어야 합니다',
  })
  date?: string;

  @ApiPropertyOptional({
    description:
      '같은 날짜 실행분이 있으면 그날의 이슈·사실·카드를 지우고 다시 만든다. 기본 false(있으면 409)',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  force?: boolean;
}
