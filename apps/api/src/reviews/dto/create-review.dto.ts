import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { trimToOptional } from './trim-to-optional';
import { ReviewTargetType } from './review-target-type.enum';

export class CreateReviewDto {
  @ApiProperty({ enum: ReviewTargetType })
  @IsEnum(ReviewTargetType)
  targetType!: ReviewTargetType;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  targetId!: string;

  @ApiProperty({ minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

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
