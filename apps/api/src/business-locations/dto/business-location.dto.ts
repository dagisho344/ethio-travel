import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BusinessLocationStatus, BusinessWeekday } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export const localTimePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export class CreateBusinessLocationDto {
  @ApiProperty({ maxLength: 120 })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  label!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  cityId!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsUUID()
  @IsOptional()
  destinationId?: string | null;

  @ApiProperty({ maxLength: 240 })
  @IsString()
  @MinLength(2)
  @MaxLength(240)
  addressLine1!: string;

  @ApiPropertyOptional({ maxLength: 240, nullable: true })
  @IsString()
  @MaxLength(240)
  @IsOptional()
  addressLine2?: string | null;

  @ApiPropertyOptional({ maxLength: 120, nullable: true })
  @IsString()
  @MaxLength(120)
  @IsOptional()
  neighborhood?: string | null;

  @ApiPropertyOptional({ maxLength: 40, nullable: true })
  @IsString()
  @MaxLength(40)
  @IsOptional()
  postalCode?: string | null;

  @ApiProperty({ minimum: -90, maximum: 90 })
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number;

  @ApiProperty({ minimum: -180, maximum: 180 })
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number;

  @ApiPropertyOptional({ example: 'Africa/Addis_Ababa', maxLength: 64 })
  @IsString()
  @MinLength(3)
  @MaxLength(64)
  @Matches(/^[A-Za-z_+-]+(?:\/[A-Za-z_+\-]+)+$/)
  @IsOptional()
  timezone?: string;
}

export class UpdateBusinessLocationDto {
  @ApiPropertyOptional({ maxLength: 120 })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  @IsOptional()
  label?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsUUID()
  @IsOptional()
  cityId?: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsUUID()
  @IsOptional()
  destinationId?: string | null;

  @ApiPropertyOptional({ maxLength: 240 })
  @IsString()
  @MinLength(2)
  @MaxLength(240)
  @IsOptional()
  addressLine1?: string;

  @ApiPropertyOptional({ maxLength: 240, nullable: true })
  @IsString()
  @MaxLength(240)
  @IsOptional()
  addressLine2?: string | null;

  @ApiPropertyOptional({ maxLength: 120, nullable: true })
  @IsString()
  @MaxLength(120)
  @IsOptional()
  neighborhood?: string | null;

  @ApiPropertyOptional({ maxLength: 40, nullable: true })
  @IsString()
  @MaxLength(40)
  @IsOptional()
  postalCode?: string | null;

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

  @ApiPropertyOptional({ example: 'Africa/Addis_Ababa', maxLength: 64 })
  @IsString()
  @MinLength(3)
  @MaxLength(64)
  @Matches(/^[A-Za-z_+-]+(?:\/[A-Za-z_+\-]+)+$/)
  @IsOptional()
  timezone?: string;

  @ApiPropertyOptional({
    enum: [BusinessLocationStatus.ACTIVE, BusinessLocationStatus.INACTIVE],
  })
  @IsEnum(BusinessLocationStatus)
  @IsOptional()
  status?: BusinessLocationStatus;
}

export class OperatingHourDto {
  @ApiProperty({ enum: BusinessWeekday })
  @IsEnum(BusinessWeekday)
  dayOfWeek!: BusinessWeekday;

  @ApiProperty()
  @IsBoolean()
  isClosed!: boolean;

  @ApiPropertyOptional({ example: '08:00', nullable: true })
  @IsString()
  @Matches(localTimePattern)
  @IsOptional()
  opensAt?: string | null;

  @ApiPropertyOptional({ example: '18:00', nullable: true })
  @IsString()
  @Matches(localTimePattern)
  @IsOptional()
  closesAt?: string | null;
}

export class ReplaceOperatingHoursDto {
  @ApiProperty({ type: [OperatingHourDto], minItems: 7, maxItems: 7 })
  @IsArray()
  @ArrayMinSize(7)
  @ArrayMaxSize(7)
  @ValidateNested({ each: true })
  @Type(() => OperatingHourDto)
  hours!: OperatingHourDto[];
}
