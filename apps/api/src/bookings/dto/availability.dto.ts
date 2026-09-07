import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { AvailabilityOverrideType, BookingMode } from '@prisma/client';

export class UpsertAvailabilityConfigDto {
  @IsBoolean()
  @IsOptional()
  enabled?: boolean;

  @IsEnum(BookingMode)
  @IsOptional()
  bookingMode?: BookingMode;

  @IsString()
  @MaxLength(80)
  @IsOptional()
  timezone?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10000)
  @IsOptional()
  capacity?: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  minQuantity?: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  maxQuantity?: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  minDurationMinutes?: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  maxDurationMinutes?: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  advanceNoticeMinutes?: number;
}

export class CreateAvailabilityRuleDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(6)
  weekday!: number;

  @Matches(/^([01][0-9]|2[0-3]):[0-5][0-9]$/)
  startTime!: string;

  @Matches(/^([01][0-9]|2[0-3]):[0-5][0-9]$/)
  endTime!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10000)
  capacity!: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsDateString()
  @IsOptional()
  validFrom?: string;

  @IsDateString()
  @IsOptional()
  validUntil?: string;
}

export class UpdateAvailabilityRuleDto extends CreateAvailabilityRuleDto {
  @ApiPropertyOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(6)
  @IsOptional()
  declare weekday: number;

  @IsOptional()
  declare startTime: string;

  @IsOptional()
  declare endTime: string;

  @IsOptional()
  declare capacity: number;
}

export class CreateAvailabilityOverrideDto {
  @IsDateString()
  startAt!: string;

  @IsDateString()
  endAt!: string;

  @IsEnum(AvailabilityOverrideType)
  @IsOptional()
  type?: AvailabilityOverrideType;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10000)
  @IsOptional()
  capacity?: number;

  @IsString()
  @MaxLength(300)
  @IsOptional()
  reason?: string;
}
export class UpdateAvailabilityOverrideDto extends CreateAvailabilityOverrideDto {
  @IsOptional()
  declare startAt: string;

  @IsOptional()
  declare endAt: string;

  @IsOptional()
  declare type: AvailabilityOverrideType;

  @IsOptional()
  declare capacity: number;
}
