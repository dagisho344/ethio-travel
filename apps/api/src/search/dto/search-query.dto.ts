import { BadRequestException } from '@nestjs/common';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PricingModel } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
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
  PRICE_ASC = 'price_asc',
  PRICE_DESC = 'price_desc',
}

export function parseSearchTypes(
  value: unknown,
): SearchEntityType[] | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string' && !Array.isArray(value)) {
    throw new BadRequestException('Types must be a comma-separated string.');
  }
  const raw = Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string').join(',')
    : value;
  const types = raw
    .split(',')
    .map((type) => type.trim())
    .filter(Boolean);
  const valid = new Set(Object.values(SearchEntityType));
  const invalid = types.find((type) => !valid.has(type as SearchEntityType));
  if (invalid)
    throw new BadRequestException(`Unsupported search type: ${invalid}.`);
  return [...new Set(types)] as SearchEntityType[];
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

  @ApiPropertyOptional({ minimum: 0 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  minPrice?: number;

  @ApiPropertyOptional({ minimum: 0 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  maxPrice?: number;

  @ApiPropertyOptional({ enum: SearchSort, default: SearchSort.RELEVANCE })
  @IsEnum(SearchSort)
  @IsOptional()
  sort: SearchSort = SearchSort.RELEVANCE;
}
