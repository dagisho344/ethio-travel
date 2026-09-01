import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { PublicationStatus } from '@prisma/client';
import { SLUG_PATTERN } from '../../common/utils/slug.util';
import { TravelInfoDto } from './travel-info.dto';

export class CreateDestinationDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  cityId!: string;

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

  @ApiProperty({ maxLength: 300 })
  @IsString()
  @MaxLength(300)
  shortDescription!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(20000)
  fullDescription!: string;

  @ApiProperty({ minimum: -90, maximum: 90 })
  @Type(() => Number)
  @IsLatitude()
  latitude!: number;

  @ApiProperty({ minimum: -180, maximum: 180 })
  @Type(() => Number)
  @IsLongitude()
  longitude!: number;

  @ApiPropertyOptional({ type: TravelInfoDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => TravelInfoDto)
  travelInfo?: TravelInfoDto;

  @ApiPropertyOptional({ enum: PublicationStatus })
  @IsOptional()
  @IsEnum(PublicationStatus)
  status?: PublicationStatus;
}
