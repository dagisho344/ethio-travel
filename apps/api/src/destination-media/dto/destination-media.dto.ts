import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MediaRole } from '@prisma/client';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export const DESTINATION_MEDIA_ROLES = [
  MediaRole.HERO,
  MediaRole.GALLERY,
] as const;

export class UploadDestinationMediaDto {
  @ApiProperty({ enum: DESTINATION_MEDIA_ROLES })
  @IsIn(DESTINATION_MEDIA_ROLES)
  role!: (typeof DESTINATION_MEDIA_ROLES)[number];

  @ApiPropertyOptional({ maxLength: 240 })
  @IsOptional()
  @IsString()
  @MaxLength(240)
  altText?: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  caption?: string;
}

export class UpdateDestinationMediaDto {
  @ApiPropertyOptional({ maxLength: 240, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(240)
  altText?: string | null;

  @ApiPropertyOptional({ maxLength: 500, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  caption?: string | null;
}

export class ReorderDestinationMediaDto {
  @ApiProperty({ type: [String], format: 'uuid' })
  @IsArray()
  @ArrayMaxSize(12)
  @IsUUID('4', { each: true })
  mediaIds!: string[];
}
