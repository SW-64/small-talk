import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

const AGE_CODES = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'];

export class DatalabTestRequestDto {
  @ApiProperty({
    description:
      '조회할 검색어. 5개씩 나눠 요청하며 다른 요청끼리 ratio 는 비교 불가',
    example: ['사이버트럭', '첫눈'],
    type: [String],
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(25)
  @ArrayUnique()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  terms!: string[];

  @ApiPropertyOptional({
    description: '데이터랩 연령 코드. 생략하면 설정값(25~39세)',
    example: ['4', '5', '6'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsIn(AGE_CODES, { each: true })
  ages?: string[];

  @ApiPropertyOptional({
    description: '어제 포함 조회 일수',
    default: 8,
    minimum: 2,
    maximum: 90,
  })
  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(90)
  days?: number;
}
