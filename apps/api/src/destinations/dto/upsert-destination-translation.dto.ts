import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';

function trimText({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export class UpsertDestinationTranslationDto {
  @ApiPropertyOptional({ maxLength: 180, nullable: true })
  @IsOptional()
  @Transform(trimText)
  @IsString()
  @MaxLength(180)
  displayName?: string | null;

  @ApiPropertyOptional({ maxLength: 300, nullable: true })
  @IsOptional()
  @Transform(trimText)
  @IsString()
  @MaxLength(300)
  shortDescription?: string | null;

  @ApiPropertyOptional({ maxLength: 20000, nullable: true })
  @IsOptional()
  @Transform(trimText)
  @IsString()
  @MaxLength(20000)
  fullDescription?: string | null;

  @ApiPropertyOptional({ maxLength: 1000, nullable: true })
  @IsOptional()
  @Transform(trimText)
  @IsString()
  @MaxLength(1000)
  bestTimeToVisit?: string | null;

  @ApiPropertyOptional({ maxLength: 1000, nullable: true })
  @IsOptional()
  @Transform(trimText)
  @IsString()
  @MaxLength(1000)
  gettingThere?: string | null;

  @ApiPropertyOptional({ maxLength: 1000, nullable: true })
  @IsOptional()
  @Transform(trimText)
  @IsString()
  @MaxLength(1000)
  localTips?: string | null;

  @ApiPropertyOptional({ maxLength: 1000, nullable: true })
  @IsOptional()
  @Transform(trimText)
  @IsString()
  @MaxLength(1000)
  safetyNotes?: string | null;
}
