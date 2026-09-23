import { BadRequestException } from '@nestjs/common';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PricingModel } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

export enum SearchEntityType {
  DESTINATION = 'destination',
  ATTRACTION = 'attraction',
  BUSINESS = 'business',
  SERVICE = 'service',
}

export enum SearchSort {
  RELEVANCE = 'relevance',
  NAME_ASC = 'name_asc',
  NAME_DESC = 'name_desc',
  NEWEST = 'newest',
  DISTANCE = 'distance',
}

export function parseSearchTypes(
  value: unknown,
): SearchEntityType[] | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (
    (typeof value !== 'string' && !Array.isArray(value)) ||
    (Array.isArray(value) && !value.every((item) => typeof item === 'string'))
  ) {
    throw new BadRequestException('Types must be a comma-separated string.');
  }
  const raw = Array.isArray(value) ? value.join(',') : value;
  const types = raw
    .split(',')
    .map((type) => type.trim())
    .filter(Boolean);
  const valid = new Set(Object.values(SearchEntityType));
  const invalid = types.find((type) => !valid.has(type as SearchEntityType));
  if (invalid) {
    throw new BadRequestException(`Unsupported search type: ${invalid}.`);
  }
  return [...new Set(types)] as SearchEntityType[];
}

export function parseFiniteNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string' || value.trim() === '') {
    throw new BadRequestException('Value must be a finite number.');
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new BadRequestException('Value must be a finite number.');
  }
  return parsed;
}

export class SearchQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: SearchEntityType, isArray: true })
  @Transform(({ value }) => parseSearchTypes(value))
  @IsArray()
  @IsEnum(SearchEntityType, { each: true })
  @IsOptional()
  types?: SearchEntityType[];

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

  @ApiPropertyOptional({ enum: SearchSort, default: SearchSort.RELEVANCE })
  @IsEnum(SearchSort)
  @IsOptional()
  sort: SearchSort = SearchSort.RELEVANCE;
}
