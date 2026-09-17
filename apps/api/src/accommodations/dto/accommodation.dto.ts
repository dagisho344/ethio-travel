import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  MinLength,
  Min,
} from 'class-validator';

const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
const moneyPattern = /^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/;

function trimString(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export class UpdateAccommodationDetailDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 5, nullable: true })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  @IsOptional()
  starClass?: number | null;

  @ApiPropertyOptional({
    pattern: '^([01]\\d|2[0-3]):[0-5]\\d$',
    nullable: true,
  })
  @Transform(({ value }: { value: unknown }) => trimString(value))
  @IsString()
  @Matches(timePattern)
  @IsOptional()
  checkInTime?: string | null;

  @ApiPropertyOptional({
    pattern: '^([01]\\d|2[0-3]):[0-5]\\d$',
    nullable: true,
  })
  @Transform(({ value }: { value: unknown }) => trimString(value))
  @IsString()
  @Matches(timePattern)
  @IsOptional()
  checkOutTime?: string | null;
}

export class CreateRoomTypeDto {
  @ApiProperty({ minLength: 1, maxLength: 180 })
  @Transform(({ value }: { value: unknown }) => trimString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(180)
  name!: string;

  @ApiPropertyOptional({ maxLength: 1000 })
  @Transform(({ value }: { value: unknown }) => trimString(value))
  @IsString()
  @MaxLength(1000)
  @IsOptional()
  description?: string | null;

  @ApiProperty({ minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  capacity!: number;

  @ApiProperty({
    description: 'Decimal amount with up to two fraction digits.',
    example: '1250.00',
    pattern: '^(?:0|[1-9]\\d{0,9})(?:\\.\\d{1,2})?$',
  })
  @Transform(({ value }: { value: unknown }) => trimString(value))
  @IsString()
  @Matches(moneyPattern)
  basePrice!: string;

  @ApiProperty({ pattern: '^[A-Z]{3}$', example: 'ETB' })
  @Transform(({ value }: { value: unknown }) => trimString(value))
  @IsString()
  @Matches(/^[A-Z]{3}$/)
  currency!: string;

  @ApiProperty({ minimum: 0 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  quantity!: number;
}

export class UpdateRoomTypeDto {
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

  @ApiPropertyOptional({ minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  capacity?: number;

  @ApiPropertyOptional({
    description: 'Decimal amount with up to two fraction digits.',
    pattern: '^(?:0|[1-9]\\d{0,9})(?:\\.\\d{1,2})?$',
  })
  @Transform(({ value }: { value: unknown }) => trimString(value))
  @IsString()
  @Matches(moneyPattern)
  @IsOptional()
  basePrice?: string;

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
  quantity?: number;
}

export class RoomTypeActiveDto {
  @ApiProperty({
    description: 'Room type availability in the accommodation catalogue.',
  })
  @IsBoolean()
  isActive!: boolean;
}
