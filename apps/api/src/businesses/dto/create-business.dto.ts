import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEmail,
  IsNumber,
  Max,
  Min,
  IsOptional,
  IsString,
  IsUUID,
  IsUrl,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { SLUG_PATTERN } from '../../common/utils/slug.util';

export class CreateBusinessDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() cityId!: string;
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  destinationId?: string;
  @ApiProperty({ format: 'uuid' }) @IsUUID() categoryId!: string;
  @ApiProperty({ maxLength: 180, minLength: 2 })
  @IsString()
  @MinLength(2)
  @MaxLength(180)
  name!: string;
  @ApiPropertyOptional({ pattern: SLUG_PATTERN.source })
  @IsOptional()
  @IsString()
  @Matches(SLUG_PATTERN)
  @MaxLength(200)
  slug?: string;
  @ApiProperty()
  @IsString()
  @MinLength(10)
  @MaxLength(20000)
  description!: string;
  @ApiPropertyOptional({ maxLength: 40 })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;
  @ApiPropertyOptional({ maxLength: 254 })
  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string;
  @ApiPropertyOptional({ maxLength: 2048 })
  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(2048)
  website?: string;
  @ApiProperty({ maxLength: 240 })
  @IsString()
  @MinLength(2)
  @MaxLength(240)
  addressLine1!: string;
  @ApiPropertyOptional({ maxLength: 240 })
  @IsOptional()
  @IsString()
  @MaxLength(240)
  addressLine2?: string;
  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  neighborhood?: string;
  @ApiPropertyOptional({ maxLength: 40 })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  postalCode?: string;
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
}
