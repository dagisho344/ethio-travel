import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import {
  PricingModel,
  ServiceCategoryFamily,
  ServiceStatus,
} from '@prisma/client';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

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
}

export class AdminServiceQueryDto extends ServiceQueryDto {
  @ApiPropertyOptional({ enum: ServiceStatus })
  @IsEnum(ServiceStatus)
  @IsOptional()
  status?: ServiceStatus;
}
