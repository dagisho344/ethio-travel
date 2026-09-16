import { ApiPropertyOptional } from '@nestjs/swagger';
import { BookingStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class AvailabilityQueryDto {
  @ApiPropertyOptional({ description: 'UTC ISO start datetime.' })
  @IsDateString()
  startAt!: string;

  @ApiPropertyOptional({ description: 'UTC ISO end datetime.' })
  @IsDateString()
  endAt!: string;

  @ApiPropertyOptional({ default: 1, minimum: 1, maximum: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  quantity = 1;
}

export class CreateBookingDto {
  @IsUUID()
  serviceId!: string;

  @IsDateString()
  startAt!: string;

  @IsDateString()
  endAt!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  quantity = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  @IsOptional()
  guestCount?: number;

  @IsString()
  @MaxLength(1000)
  @IsOptional()
  travelerNote?: string;
}

export class BookingQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit = 20;

  @IsString()
  @IsOptional()
  status?: string;
}

export class AdminBookingQueryDto extends BookingQueryDto {
  @ApiPropertyOptional({ enum: BookingStatus })
  @IsEnum(BookingStatus)
  @IsOptional()
  declare status?: BookingStatus;

  @ApiPropertyOptional({ maxLength: 32 })
  @IsString()
  @MaxLength(32)
  @IsOptional()
  reference?: string;

  @ApiPropertyOptional({ maxLength: 120 })
  @IsString()
  @MaxLength(120)
  @IsOptional()
  traveler?: string;

  @ApiPropertyOptional({ maxLength: 120 })
  @IsString()
  @MaxLength(120)
  @IsOptional()
  business?: string;

  @ApiPropertyOptional({ maxLength: 120 })
  @IsString()
  @MaxLength(120)
  @IsOptional()
  service?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsDateString()
  @IsOptional()
  startFrom?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsDateString()
  @IsOptional()
  startTo?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsDateString()
  @IsOptional()
  createdFrom?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsDateString()
  @IsOptional()
  createdTo?: string;
}

export class BookingActionDto {
  @IsString()
  @MaxLength(1000)
  @IsOptional()
  reason?: string;

  @IsString()
  @MaxLength(1000)
  @IsOptional()
  note?: string;
}
