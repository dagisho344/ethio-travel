import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ServiceCategoryFamily } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateServiceCategoryDto {
  @ApiProperty({ maxLength: 80, pattern: '^[A-Z0-9_]+$' })
  @IsString()
  @MaxLength(80)
  @Matches(/^[A-Z0-9_]+$/)
  code!: string;

  @ApiPropertyOptional({
    enum: ServiceCategoryFamily,
    default: ServiceCategoryFamily.OTHER,
  })
  @IsEnum(ServiceCategoryFamily)
  @IsOptional()
  family?: ServiceCategoryFamily;

  @ApiProperty({ maxLength: 120 })
  @IsString()
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(1000)
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({ default: 0 })
  @IsInt()
  @Min(0)
  @IsOptional()
  sortOrder?: number;
}
