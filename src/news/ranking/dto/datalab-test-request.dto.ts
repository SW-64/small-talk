import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

const AGE_CODES = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'];

export class DatalabTestRequestDto {
  @ApiProperty({
    description:
      '조회할 검색어. 4개씩 나눠 기준 키워드와 함께 요청하고, 기준 키워드 대비 어제 점수로 비교한다',
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
    description:
      '공통 기준 키워드. 생략하면 설정값. 기준 키워드 후보를 비교할 때 바꿔 본다',
    example: '날씨',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  anchor?: string;
}
