import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PricingModel, ServiceLocationMode } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class ServiceAttributesDto {
  @ApiPropertyOptional({ type: [String], maxItems: 30 })
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  @IsOptional()
  highlights?: string[];

  @ApiPropertyOptional({ type: [String], maxItems: 30 })
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  @IsOptional()
  included?: string[];

  @ApiPropertyOptional({ type: [String], maxItems: 30 })
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  @IsOptional()
  excluded?: string[];

  @ApiPropertyOptional({ type: [String], maxItems: 30 })
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  @IsOptional()
  requirements?: string[];

  @ApiPropertyOptional({ type: [String], maxItems: 30 })
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  @IsOptional()
  tags?: string[];
}

export class CreateServiceDto {
  @ApiProperty()
  @IsString()
  categoryId!: string;

  @ApiProperty({ minLength: 2, maxLength: 180 })
  @IsString()
  @MaxLength(180)
  name!: string;

  @ApiPropertyOptional({
    maxLength: 200,
    pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$',
  })
  @IsString()
  @MaxLength(200)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  @IsOptional()
  slug?: string;

  @ApiProperty({ maxLength: 300 })
  @IsString()
  @MaxLength(300)
  shortDescription!: string;

  @ApiProperty({ maxLength: 20000 })
  @IsString()
  @MaxLength(20000)
  description!: string;

  @ApiProperty({ enum: PricingModel })
  @IsEnum(PricingModel)
  pricingModel!: PricingModel;

  @ApiPropertyOptional({ minimum: 0 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  price?: number;

  @ApiPropertyOptional({ pattern: '^[A-Z]{3}$' })
  @IsString()
  @Matches(/^[A-Z]{3}$/)
  @IsOptional()
  currency?: string;

  @ApiPropertyOptional({ minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  durationMinutes?: number;

  @ApiPropertyOptional({ minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  minGuests?: number;

  @ApiPropertyOptional({ minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  maxGuests?: number;

  @ApiPropertyOptional({
    enum: ServiceLocationMode,
    default: ServiceLocationMode.BUSINESS_LOCATION,
  })
  @IsEnum(ServiceLocationMode)
  @IsOptional()
  locationMode?: ServiceLocationMode;

  @ApiPropertyOptional({ maxLength: 240 })
  @IsString()
  @MaxLength(240)
  @IsOptional()
  address?: string;

  @ApiPropertyOptional({ minimum: -90, maximum: 90 })
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  @IsOptional()
  latitude?: number;

  @ApiPropertyOptional({ minimum: -180, maximum: 180 })
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  @IsOptional()
  longitude?: number;

  @ApiPropertyOptional({ type: ServiceAttributesDto })
  @IsObject()
  @IsOptional()
  attributes?: ServiceAttributesDto;
}
