import { BadRequestException } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
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
import { SearchEntityType } from '../../search/dto/search-query.dto';

function parseTypes(value: unknown): SearchEntityType[] | undefined {
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
    throw new BadRequestException(`Unsupported map type: ${invalid}.`);
  return [...new Set(types)] as SearchEntityType[];
}

export class MapPlacesQueryDto {
  @ApiProperty({ minimum: -90, maximum: 90 })
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  north!: number;

  @ApiProperty({ minimum: -90, maximum: 90 })
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  south!: number;

  @ApiProperty({ minimum: -180, maximum: 180 })
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  east!: number;

  @ApiProperty({ minimum: -180, maximum: 180 })
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  west!: number;

  @ApiPropertyOptional({ enum: SearchEntityType, isArray: true })
  @Transform(({ value }) => parseTypes(value))
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

  @ApiPropertyOptional({ default: 200, maximum: 500, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  @IsOptional()
  limit = 200;
}
