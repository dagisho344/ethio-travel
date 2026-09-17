import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const moneyPattern = /^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/;

function trimString(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

function trimCuisineTypes(value: unknown): unknown {
  return Array.isArray(value) ? value.map((item) => trimString(item)) : value;
}

export class UpdateRestaurantDetailDto {
  @ApiPropertyOptional({
    type: [String],
    description: 'Extensible cuisine labels, with at most 20 trimmed values.',
    maxItems: 20,
  })
  @Transform(({ value }: { value: unknown }) => trimCuisineTypes(value))
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(80, { each: true })
  @IsOptional()
  cuisineTypes?: string[];

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  reservationSupported?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  deliverySupported?: boolean;
}

export class CreateRestaurantMenuDto {
  @ApiProperty({ minLength: 1, maxLength: 180 })
  @Transform(({ value }: { value: unknown }) => trimString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(180)
  name!: string;

  @ApiPropertyOptional({ maxLength: 1000, nullable: true })
  @Transform(({ value }: { value: unknown }) => trimString(value))
  @IsString()
  @MaxLength(1000)
  @IsOptional()
  description?: string | null;

  @ApiPropertyOptional({ minimum: 0, default: 0 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  sortOrder?: number;
}

export class UpdateRestaurantMenuDto {
  @ApiPropertyOptional({ minLength: 1, maxLength: 180 })
  @Transform(({ value }: { value: unknown }) => trimString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(180)
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ maxLength: 1000, nullable: true })
  @Transform(({ value }: { value: unknown }) => trimString(value))
  @IsString()
  @MaxLength(1000)
  @IsOptional()
  description?: string | null;

  @ApiPropertyOptional({ minimum: 0 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  sortOrder?: number;
}

export class CreateRestaurantMenuItemDto {
  @ApiPropertyOptional({ maxLength: 120, nullable: true })
  @Transform(({ value }: { value: unknown }) => trimString(value))
  @IsString()
  @MaxLength(120)
  @IsOptional()
  section?: string | null;

  @ApiProperty({ minLength: 1, maxLength: 180 })
  @Transform(({ value }: { value: unknown }) => trimString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(180)
  name!: string;

  @ApiPropertyOptional({ maxLength: 1000, nullable: true })
  @Transform(({ value }: { value: unknown }) => trimString(value))
  @IsString()
  @MaxLength(1000)
  @IsOptional()
  description?: string | null;

  @ApiProperty({
    description: 'Decimal amount with up to two fraction digits.',
    example: '250.00',
    pattern: '^(?:0|[1-9]\\d{0,9})(?:\\.\\d{1,2})?$',
  })
  @Transform(({ value }: { value: unknown }) => trimString(value))
  @IsString()
  @Matches(moneyPattern)
  price!: string;

  @ApiProperty({ pattern: '^[A-Z]{3}$', example: 'ETB' })
  @Transform(({ value }: { value: unknown }) => trimString(value))
  @IsString()
  @Matches(/^[A-Z]{3}$/)
  currency!: string;

  @ApiPropertyOptional({ minimum: 0, default: 0 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  sortOrder?: number;
}

export class UpdateRestaurantMenuItemDto {
  @ApiPropertyOptional({ maxLength: 120, nullable: true })
  @Transform(({ value }: { value: unknown }) => trimString(value))
  @IsString()
  @MaxLength(120)
  @IsOptional()
  section?: string | null;

  @ApiPropertyOptional({ minLength: 1, maxLength: 180 })
  @Transform(({ value }: { value: unknown }) => trimString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(180)
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ maxLength: 1000, nullable: true })
  @Transform(({ value }: { value: unknown }) => trimString(value))
  @IsString()
  @MaxLength(1000)
  @IsOptional()
  description?: string | null;

  @ApiPropertyOptional({
    description: 'Decimal amount with up to two fraction digits.',
    pattern: '^(?:0|[1-9]\\d{0,9})(?:\\.\\d{1,2})?$',
  })
  @Transform(({ value }: { value: unknown }) => trimString(value))
  @IsString()
  @Matches(moneyPattern)
  @IsOptional()
  price?: string;

  @ApiPropertyOptional({ pattern: '^[A-Z]{3}$' })
  @Transform(({ value }: { value: unknown }) => trimString(value))
  @IsString()
  @Matches(/^[A-Z]{3}$/)
  @IsOptional()
  currency?: string;

  @ApiPropertyOptional({ minimum: 0 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  sortOrder?: number;
}
