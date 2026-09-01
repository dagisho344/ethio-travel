import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { AttractionCategory, PublicationStatus } from '@prisma/client';
import { SLUG_PATTERN } from '../../common/utils/slug.util';
import { ContactInfoDto } from './contact-info.dto';
import { OpeningInfoDto } from './opening-info.dto';

export class CreateAttractionDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  destinationId!: string;

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

  @ApiProperty({ enum: AttractionCategory })
  @IsEnum(AttractionCategory)
  category!: AttractionCategory;

  @ApiProperty()
  @IsString()
  @MaxLength(20000)
  description!: string;

  @ApiProperty({ minimum: -90, maximum: 90 })
  @Type(() => Number)
  @IsLatitude()
  latitude!: number;

  @ApiProperty({ minimum: -180, maximum: 180 })
  @Type(() => Number)
  @IsLongitude()
  longitude!: number;

  @ApiPropertyOptional({ minimum: 0 })
  @Type(() => Number)
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  entranceFee?: number;

  @ApiPropertyOptional({ pattern: '^[A-Z]{3}$' })
  @ValidateIf(
    (dto: CreateAttractionDto) =>
      dto.entranceFee !== undefined || dto.currency !== undefined,
  )
  @IsString()
  @Matches(/^[A-Z]{3}$/)
  currency?: string;

  @ApiPropertyOptional({ type: OpeningInfoDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => OpeningInfoDto)
  openingInfo?: OpeningInfoDto;

  @ApiPropertyOptional({ type: ContactInfoDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ContactInfoDto)
  contactInfo?: ContactInfoDto;

  @ApiPropertyOptional({ enum: PublicationStatus })
  @IsOptional()
  @IsEnum(PublicationStatus)
  status?: PublicationStatus;
}
