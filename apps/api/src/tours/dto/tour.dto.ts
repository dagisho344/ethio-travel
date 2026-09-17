import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

function trimString(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

function trimStringArray(value: unknown): unknown {
  return Array.isArray(value) ? value.map((item) => trimString(item)) : value;
}

export class UpdateTourDetailDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 365 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  @IsOptional()
  durationDays?: number;

  @ApiPropertyOptional({ minLength: 1, maxLength: 40 })
  @Transform(({ value }: { value: unknown }) => trimString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  @IsOptional()
  difficulty?: string;

  @ApiPropertyOptional({ minLength: 1, maxLength: 240 })
  @Transform(({ value }: { value: unknown }) => trimString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(240)
  @IsOptional()
  meetingPoint?: string;

  @ApiPropertyOptional({
    type: [String],
    maxItems: 30,
    description: 'Trimmed inclusion labels, each at most 300 characters.',
  })
  @Transform(({ value }: { value: unknown }) => trimStringArray(value))
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(300, { each: true })
  @IsOptional()
  inclusions?: string[];

  @ApiPropertyOptional({
    type: [String],
    maxItems: 30,
    description: 'Trimmed exclusion labels, each at most 300 characters.',
  })
  @Transform(({ value }: { value: unknown }) => trimStringArray(value))
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(300, { each: true })
  @IsOptional()
  exclusions?: string[];
}

export class CreateTourItineraryItemDto {
  @ApiProperty({ minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  dayNumber!: number;

  @ApiProperty({ minLength: 1, maxLength: 180 })
  @Transform(({ value }: { value: unknown }) => trimString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(180)
  title!: string;

  @ApiPropertyOptional({ maxLength: 2000, nullable: true })
  @Transform(({ value }: { value: unknown }) => trimString(value))
  @IsString()
  @MaxLength(2000)
  @IsOptional()
  description?: string | null;

  @ApiPropertyOptional({ minimum: 0, default: 0 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  sortOrder?: number;
}

export class UpdateTourItineraryItemDto {
  @ApiPropertyOptional({ minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  dayNumber?: number;

  @ApiPropertyOptional({ minLength: 1, maxLength: 180 })
  @Transform(({ value }: { value: unknown }) => trimString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(180)
  @IsOptional()
  title?: string;

  @ApiPropertyOptional({ maxLength: 2000, nullable: true })
  @Transform(({ value }: { value: unknown }) => trimString(value))
  @IsString()
  @MaxLength(2000)
  @IsOptional()
  description?: string | null;

  @ApiPropertyOptional({ minimum: 0 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  sortOrder?: number;
}
