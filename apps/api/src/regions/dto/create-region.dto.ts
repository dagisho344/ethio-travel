import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { LocationStatus } from '@prisma/client';
import { SLUG_PATTERN } from '../../common/utils/slug.util';

export class CreateRegionDto {
  @ApiProperty({ maxLength: 160, minLength: 2 })
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name!: string;

  @ApiPropertyOptional({ pattern: SLUG_PATTERN.source })
  @IsOptional()
  @IsString()
  @Matches(SLUG_PATTERN)
  @MaxLength(180)
  slug?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @ApiPropertyOptional({ enum: LocationStatus })
  @IsOptional()
  @IsEnum(LocationStatus)
  status?: LocationStatus;
}
