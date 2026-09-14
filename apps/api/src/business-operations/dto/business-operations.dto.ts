import { ApiPropertyOptional } from '@nestjs/swagger';
import { ReviewStatus } from '@prisma/client';
import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

export class BusinessReviewQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ReviewStatus })
  @IsEnum(ReviewStatus)
  @IsOptional()
  status?: ReviewStatus;
}

export class UpsertBusinessReviewResponseDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  body!: string;
}
