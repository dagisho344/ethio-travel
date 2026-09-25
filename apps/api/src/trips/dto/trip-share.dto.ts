import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';

function trimString(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export class CreateTripShareDto {
  @ApiPropertyOptional({
    format: 'date-time',
    description: 'Optional future UTC expiration for the share link.',
  })
  @Transform(({ value }: { value: unknown }) => trimString(value))
  @IsDateString()
  @IsOptional()
  expiresAt?: string;
}

export class UpdateTripShareDto {
  @ApiPropertyOptional({
    format: 'date-time',
    nullable: true,
    description: 'A future UTC expiration, or null for no expiration.',
  })
  @Transform(({ value }: { value: unknown }) => trimString(value))
  @IsDateString()
  @IsOptional()
  expiresAt?: string | null;
}

export class ResolveTripShareDto {
  @ApiProperty({
    minLength: 64,
    maxLength: 64,
    pattern: '^[A-Za-z0-9_-]+$',
    description:
      'A 48-byte base64url share secret submitted in the request body.',
  })
  @Transform(({ value }: { value: unknown }) => trimString(value))
  @IsString()
  @Length(64, 64)
  @Matches(/^[A-Za-z0-9_-]+$/)
  token!: string;
}
