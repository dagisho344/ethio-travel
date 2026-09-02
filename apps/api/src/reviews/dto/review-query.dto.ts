import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReviewStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { ReviewTargetType } from './review-target-type.enum';

export class MyReviewQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ReviewTargetType })
  @IsEnum(ReviewTargetType)
  @IsOptional()
  targetType?: ReviewTargetType;

  @ApiPropertyOptional({ enum: ReviewStatus })
  @IsEnum(ReviewStatus)
  @IsOptional()
  status?: ReviewStatus;
}

export enum PublicReviewSort {
  NEWEST = 'newest',
  OLDEST = 'oldest',
  HIGHEST = 'highest',
  LOWEST = 'lowest',
}

export class PublicReviewQueryDto extends PaginationQueryDto {
  @ApiProperty({ enum: ReviewTargetType })
  @IsEnum(ReviewTargetType)
  targetType!: ReviewTargetType;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  targetId!: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 5 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  @IsOptional()
  rating?: number;

  @ApiPropertyOptional({
    enum: PublicReviewSort,
    default: PublicReviewSort.NEWEST,
  })
  @IsEnum(PublicReviewSort)
  @IsOptional()
  sort: PublicReviewSort = PublicReviewSort.NEWEST;
}

export class ReviewSummaryQueryDto {
  @ApiProperty({ enum: ReviewTargetType })
  @IsEnum(ReviewTargetType)
  targetType!: ReviewTargetType;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  targetId!: string;
}
