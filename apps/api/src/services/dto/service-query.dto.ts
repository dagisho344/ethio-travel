import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  PricingModel,
  ServiceCategoryFamily,
  ServiceStatus,
} from '@prisma/client';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

function strictBoolean(value: unknown): unknown {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
}

export class ServiceQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Service category code.' })
  @IsString()
  @MaxLength(80)
  @IsOptional()
  category?: string;

  @ApiPropertyOptional({
    enum: ServiceCategoryFamily,
    description: 'Stable technical service-category family.',
  })
  @IsEnum(ServiceCategoryFamily)
  @IsOptional()
  family?: ServiceCategoryFamily;

  @ApiPropertyOptional({ format: 'uuid', description: 'Public business ID.' })
  @IsUUID()
  @IsOptional()
  businessId?: string;

  @ApiPropertyOptional({ description: 'Business category code.' })
  @IsString()
  @MaxLength(80)
  @IsOptional()
  businessCategory?: string;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(180)
  @IsOptional()
  regionSlug?: string;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(180)
  @IsOptional()
  citySlug?: string;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(200)
  @IsOptional()
  destinationSlug?: string;

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

  @ApiPropertyOptional({ minimum: 1, maximum: 5 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  @IsOptional()
  starClass?: number;

  @ApiPropertyOptional({ minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  minRoomCapacity?: number;

  @ApiPropertyOptional({ enum: ['true', 'false'] })
  @Transform(({ value }: { value: unknown }) => strictBoolean(value))
  @IsBoolean()
  @IsOptional()
  reservationSupported?: boolean;

  @ApiPropertyOptional({ enum: ['true', 'false'] })
  @Transform(({ value }: { value: unknown }) => strictBoolean(value))
  @IsBoolean()
  @IsOptional()
  deliverySupported?: boolean;

  @ApiPropertyOptional({ minimum: 1, maximum: 365 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  @IsOptional()
  minDurationDays?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 365 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  @IsOptional()
  maxDurationDays?: number;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(180)
  @IsOptional()
  originRegionSlug?: string;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(180)
  @IsOptional()
  originCitySlug?: string;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(180)
  @IsOptional()
  destinationRegionSlug?: string;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(180)
  @IsOptional()
  destinationCitySlug?: string;
}

export class AdminServiceQueryDto extends ServiceQueryDto {
  @ApiPropertyOptional({ enum: ServiceStatus })
  @IsEnum(ServiceStatus)
  @IsOptional()
  status?: ServiceStatus;
}
