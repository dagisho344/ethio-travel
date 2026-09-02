import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, IsOptional, Max, MaxLength, Min } from 'class-validator';
import { trimToOptional } from './trim-to-optional';

export class UpdateReviewDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  @IsOptional()
  rating?: number;

  @ApiPropertyOptional({ maxLength: 120 })
  @Transform(({ value }) => trimToOptional(value))
  @IsOptional()
  @MaxLength(120)
  title?: string;

  @ApiPropertyOptional({ maxLength: 5000 })
  @Transform(({ value }) => trimToOptional(value))
  @IsOptional()
  @MaxLength(5000)
  body?: string;
}
