import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';

function normalizeText({ value }: { value: unknown }): unknown {
  if (typeof value !== 'string') return value;
  return value.trim() || null;
}

export class UpsertRegionTranslationDto {
  @ApiPropertyOptional({ maxLength: 160, nullable: true })
  @IsOptional()
  @Transform(normalizeText)
  @IsString()
  @MaxLength(160)
  displayName?: string | null;

  @ApiPropertyOptional({ maxLength: 5000, nullable: true })
  @IsOptional()
  @Transform(normalizeText)
  @IsString()
  @MaxLength(5000)
  description?: string | null;
}

/** Lifecycle commands accept no editorial or publication fields. */
export class RegionTranslationActionDto {}
