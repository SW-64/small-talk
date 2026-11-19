import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Min,
} from 'class-validator';
import type { RankingMode, WindowType } from '../trend-issues.types';

export class TrendIssuesRequestDto {
  @ApiPropertyOptional({
    description:
      '기준 "당일"(KST, YYYY-MM-DD). 수집 기간은 전날 06:00 ~ 이 날 06:00. 생략하면 가장 최근에 끝난 06:00 기준. window=last24h 와 함께 쓸 수 없음',
    example: '2026-10-28',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'date 는 YYYY-MM-DD 형식이어야 합니다',
  })
  date?: string;

  @ApiPropertyOptional({
    description: '실행할 카테고리 id 목록. 생략하면 전체',
    example: ['economy', 'tech'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  categories?: string[];

  @ApiPropertyOptional({
    description:
      '테스트용: 카테고리당 사용할 키워드 수 (설정 순서로 앞에서부터)',
    example: 1,
    minimum: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxKeywordsPerCategory?: number;

  @ApiPropertyOptional({
    description:
      'previousDay: 전날 06:00 ~ 당일 06:00 (기본), last24h: 실행 시각 기준 최근 24시간',
    enum: ['previousDay', 'last24h'],
    default: 'previousDay',
  })
  @IsOptional()
  @IsIn(['previousDay', 'last24h'])
  window?: WindowType;

  @ApiPropertyOptional({
    description: 'datalab: 선택 단계 뒤에 데이터랩 검색량 랭킹을 추가',
    enum: ['none', 'datalab'],
    default: 'none',
  })
  @IsOptional()
  @IsIn(['none', 'datalab'])
  ranking?: RankingMode;
}
