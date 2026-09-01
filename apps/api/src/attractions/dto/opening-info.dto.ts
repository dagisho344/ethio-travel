import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayUnique,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export enum OpeningDay {
  MONDAY = 'MONDAY',
  TUESDAY = 'TUESDAY',
  WEDNESDAY = 'WEDNESDAY',
  THURSDAY = 'THURSDAY',
  FRIDAY = 'FRIDAY',
  SATURDAY = 'SATURDAY',
  SUNDAY = 'SUNDAY',
}

export class OpeningInfoDto {
  @ApiPropertyOptional({ enum: OpeningDay, isArray: true })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsEnum(OpeningDay, { each: true })
  days?: OpeningDay[];

  @ApiPropertyOptional({ pattern: '^([01]\\d|2[0-3]):[0-5]\\d$' })
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  opensAt?: string;

  @ApiPropertyOptional({ pattern: '^([01]\\d|2[0-3]):[0-5]\\d$' })
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  closesAt?: string;

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
