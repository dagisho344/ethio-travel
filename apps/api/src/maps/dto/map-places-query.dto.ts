import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PricingModel } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  parseFiniteNumber,
  parseSearchTypes,
  SearchEntityType,
} from '../../search/dto/search-query.dto';

export class MapPlacesQueryDto {
  @ApiProperty({ minimum: -90, maximum: 90 })
  @Transform(({ value }) => parseFiniteNumber(value))
  @IsNumber()
  @Min(-90)
  @Max(90)
  north!: number;

  @ApiProperty({ minimum: -90, maximum: 90 })
  @Transform(({ value }) => parseFiniteNumber(value))
  @IsNumber()
  @Min(-90)
  @Max(90)
  south!: number;

  @ApiProperty({ minimum: -180, maximum: 180 })
  @Transform(({ value }) => parseFiniteNumber(value))
  @IsNumber()
  @Min(-180)
  @Max(180)
  east!: number;

  @ApiProperty({ minimum: -180, maximum: 180 })
  @Transform(({ value }) => parseFiniteNumber(value))
  @IsNumber()
  @Min(-180)
  @Max(180)
  west!: number;

  @ApiPropertyOptional({ enum: SearchEntityType, isArray: true })
  @Transform(({ value }) => parseSearchTypes(value))
  @IsArray()
  @IsEnum(SearchEntityType, { each: true })
  @IsOptional()
  types?: SearchEntityType[];

  @ApiPropertyOptional({ maxLength: 120 })
  @IsString()
  @MaxLength(120)
  @IsOptional()
  q?: string;

  @ApiPropertyOptional({ maxLength: 180 })
  @IsString()
  @MaxLength(180)
  @IsOptional()
  regionSlug?: string;

  @ApiPropertyOptional({ maxLength: 180 })
  @IsString()
  @MaxLength(180)
  @IsOptional()
  citySlug?: string;

  @ApiPropertyOptional({ maxLength: 200 })
  @IsString()
  @MaxLength(200)
  @IsOptional()
  destinationSlug?: string;

  @ApiPropertyOptional({ maxLength: 80 })
  @IsString()
  @MaxLength(80)
  @Matches(/^[A-Z0-9_]+$/)
  @IsOptional()
  businessCategory?: string;

  @ApiPropertyOptional({ maxLength: 80 })
  @IsString()
  @MaxLength(80)
  @Matches(/^[A-Z0-9_]+$/)
  @IsOptional()
  serviceCategory?: string;

  @ApiPropertyOptional({ enum: PricingModel })
  @IsEnum(PricingModel)
  @IsOptional()
  pricingModel?: PricingModel;
  @ApiPropertyOptional({ maxLength: 3, description: 'ISO 4217 currency code' })
  @IsString()
  @Matches(/^[A-Z]{3}$/)
  @IsOptional()
  currency?: string;

  @ApiPropertyOptional({ minimum: 0 })
  @Transform(({ value }) => parseFiniteNumber(value))
  @IsNumber()
  @Min(0)
  @IsOptional()
  minPrice?: number;

  @ApiPropertyOptional({ minimum: 0 })
  @Transform(({ value }) => parseFiniteNumber(value))
  @IsNumber()
  @Min(0)
  @IsOptional()
  maxPrice?: number;

  @ApiPropertyOptional({ minimum: -90, maximum: 90 })
  @Transform(({ value }) => parseFiniteNumber(value))
  @IsNumber()
  @Min(-90)
  @Max(90)
  @IsOptional()
  lat?: number;

  @ApiPropertyOptional({ minimum: -180, maximum: 180 })
  @Transform(({ value }) => parseFiniteNumber(value))
  @IsNumber()
  @Min(-180)
  @Max(180)
  @IsOptional()
  lng?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 200, default: 25 })
  @Transform(({ value }) => parseFiniteNumber(value))
  @IsNumber()
  @Min(1)
  @Max(200)
  @IsOptional()
  radiusKm?: number;

  @ApiPropertyOptional({ default: 200, maximum: 500, minimum: 1 })
  @Transform(({ value }) => parseFiniteNumber(value))
  @IsInt()
  @Min(1)
  @Max(500)
  @IsOptional()
  limit = 200;
}
