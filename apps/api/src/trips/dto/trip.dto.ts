import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TripItemType, TripStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/;
const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export class CreateTripDto {
  @ApiProperty({ maxLength: 160 })
  @IsString()
  @MaxLength(160)
  title!: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsUUID()
  @IsOptional()
  originCityId?: string | null;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsUUID()
  @IsOptional()
  destinationCityId?: string | null;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsUUID()
  @IsOptional()
  primaryDestinationId?: string | null;

  @ApiProperty({ format: 'date', example: '2026-10-12' })
  @IsDateString()
  @Matches(dateOnlyPattern)
  startDate!: string;

  @ApiProperty({ format: 'date', example: '2026-10-15' })
  @IsDateString()
  @Matches(dateOnlyPattern)
  endDate!: string;

  @ApiPropertyOptional({ enum: [TripStatus.DRAFT, TripStatus.UPCOMING] })
  @IsEnum(TripStatus)
  @IsOptional()
  status?: TripStatus;

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsString()
  @MaxLength(2000)
  @IsOptional()
  notes?: string | null;
}

export class UpdateTripDto {
  @ApiPropertyOptional({ maxLength: 160 })
  @IsString()
  @MaxLength(160)
  @IsOptional()
  title?: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsUUID()
  @IsOptional()
  originCityId?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsUUID()
  @IsOptional()
  destinationCityId?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsUUID()
  @IsOptional()
  primaryDestinationId?: string | null;

  @ApiPropertyOptional({ format: 'date' })
  @IsDateString()
  @Matches(dateOnlyPattern)
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional({ format: 'date' })
  @IsDateString()
  @Matches(dateOnlyPattern)
  @IsOptional()
  endDate?: string;

  @ApiPropertyOptional({ enum: [TripStatus.DRAFT, TripStatus.UPCOMING] })
  @IsEnum(TripStatus)
  @IsOptional()
  status?: TripStatus;

  @ApiPropertyOptional({ maxLength: 2000, nullable: true })
  @IsString()
  @MaxLength(2000)
  @IsOptional()
  notes?: string | null;
}

export enum TripTimingFilter {
  UPCOMING = 'UPCOMING',
  PAST = 'PAST',
}

export enum TripSort {
  NEWEST = 'NEWEST',
  SOONEST = 'SOONEST',
  RECENTLY_UPDATED = 'RECENTLY_UPDATED',
}

export class TripQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: TripStatus })
  @IsEnum(TripStatus)
  @IsOptional()
  status?: TripStatus;

  @ApiPropertyOptional({ enum: TripTimingFilter })
  @IsEnum(TripTimingFilter)
  @IsOptional()
  timing?: TripTimingFilter;

  @ApiPropertyOptional({ enum: TripSort, default: TripSort.SOONEST })
  @IsEnum(TripSort)
  @IsOptional()
  sort: TripSort = TripSort.SOONEST;
}

export class UpdateTripDayDto {
  @ApiPropertyOptional({ maxLength: 1000, nullable: true })
  @IsString()
  @MaxLength(1000)
  @IsOptional()
  notes?: string | null;
}

export class CreateTripItemDto {
  @ApiProperty({ enum: TripItemType })
  @IsEnum(TripItemType)
  type!: TripItemType;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsUUID()
  @IsOptional()
  destinationId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsUUID()
  @IsOptional()
  attractionId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsUUID()
  @IsOptional()
  businessId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsUUID()
  @IsOptional()
  serviceId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsUUID()
  @IsOptional()
  bookingId?: string;

  @ApiPropertyOptional({ maxLength: 180 })
  @IsString()
  @MaxLength(180)
  @IsOptional()
  title?: string;

  @ApiPropertyOptional({ example: '09:30', nullable: true })
  @IsString()
  @Matches(timePattern)
  @IsOptional()
  startTime?: string | null;

  @ApiPropertyOptional({ example: '11:00', nullable: true })
  @IsString()
  @Matches(timePattern)
  @IsOptional()
  endTime?: string | null;

  @ApiPropertyOptional({ maxLength: 1000, nullable: true })
  @IsString()
  @MaxLength(1000)
  @IsOptional()
  notes?: string | null;
}

export class UpdateTripItemDto {
  @ApiPropertyOptional({ maxLength: 180 })
  @IsString()
  @MaxLength(180)
  @IsOptional()
  title?: string;

  @ApiPropertyOptional({ example: '09:30', nullable: true })
  @IsString()
  @Matches(timePattern)
  @IsOptional()
  startTime?: string | null;

  @ApiPropertyOptional({ example: '11:00', nullable: true })
  @IsString()
  @Matches(timePattern)
  @IsOptional()
  endTime?: string | null;

  @ApiPropertyOptional({ maxLength: 1000, nullable: true })
  @IsString()
  @MaxLength(1000)
  @IsOptional()
  notes?: string | null;
}

export class ReorderTripItemsDto {
  @ApiProperty({ type: [String], format: 'uuid' })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  itemIds!: string[];
}
