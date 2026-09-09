import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

function trimOptional(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

export class CreateConversationDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  businessId!: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsUUID()
  @IsOptional()
  bookingId?: string;

  @ApiPropertyOptional({ maxLength: 160 })
  @Transform(({ value }) => trimOptional(value))
  @IsString()
  @MaxLength(160)
  @IsOptional()
  subject?: string;
}
