import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const moneyPattern = /^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/;

function trimString(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export class UpdateTransportDetailDto {
  @ApiPropertyOptional({ maxLength: 40 })
  @Transform(({ value }: { value: unknown }) => trimString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  @IsOptional()
  mode?: string;

  @ApiPropertyOptional({ maxLength: 180 })
  @Transform(({ value }: { value: unknown }) => trimString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(180)
  @IsOptional()
  operatorName?: string;
}

export class CreateTransportRouteDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  originCityId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  destinationCityId!: string;
}

export class UpdateTransportRouteDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsUUID('4')
  @IsOptional()
  originCityId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsUUID('4')
  @IsOptional()
  destinationCityId?: string;
}

export class CreateTransportScheduleDto {
  @ApiProperty({ format: 'date-time' })
  @IsDateString()
  @Matches(/(?:Z|[+-]\d{2}:\d{2})$/)
  departureAt!: string;

  @ApiProperty({ format: 'date-time' })
  @IsDateString()
  @Matches(/(?:Z|[+-]\d{2}:\d{2})$/)
  arrivalAt!: string;

  @ApiProperty({
    description: 'Decimal amount with up to two fraction digits.',
    pattern: '^(?:0|[1-9]\\d{0,9})(?:\\.\\d{1,2})?$',
  })
  @Transform(({ value }: { value: unknown }) => trimString(value))
  @IsString()
  @Matches(moneyPattern)
  fare!: string;

  @ApiProperty({ pattern: '^[A-Z]{3}$', example: 'ETB' })
  @Transform(({ value }: { value: unknown }) => trimString(value))
  @IsString()
  @Matches(/^[A-Z]{3}$/)
  currency!: string;

  @ApiProperty({ minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  capacity!: number;
}

export class UpdateTransportScheduleDto {
  @ApiPropertyOptional({ format: 'date-time' })
  @IsDateString()
  @Matches(/(?:Z|[+-]\d{2}:\d{2})$/)
  @IsOptional()
  departureAt?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsDateString()
  @Matches(/(?:Z|[+-]\d{2}:\d{2})$/)
  @IsOptional()
  arrivalAt?: string;

  @ApiPropertyOptional({
    description: 'Decimal amount with up to two fraction digits.',
    pattern: '^(?:0|[1-9]\\d{0,9})(?:\\.\\d{1,2})?$',
  })
  @Transform(({ value }: { value: unknown }) => trimString(value))
  @IsString()
  @Matches(moneyPattern)
  @IsOptional()
  fare?: string;

  @ApiPropertyOptional({ pattern: '^[A-Z]{3}$' })
  @Transform(({ value }: { value: unknown }) => trimString(value))
  @IsString()
  @Matches(/^[A-Z]{3}$/)
  @IsOptional()
  currency?: string;

  @ApiPropertyOptional({ minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  capacity?: number;
}
