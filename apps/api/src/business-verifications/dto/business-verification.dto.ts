import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { VerificationDocumentType } from '@prisma/client';

export class SubmitBusinessVerificationDto {}

export class UploadVerificationDocumentDto {
  @ApiProperty({ enum: VerificationDocumentType })
  @IsEnum(VerificationDocumentType)
  type!: VerificationDocumentType;
}

export class ApproveBusinessVerificationDto {
  @ApiPropertyOptional({ maxLength: 5000 })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  adminNotes?: string;
}

export class RejectBusinessVerificationDto {
  @ApiProperty({ minLength: 3, maxLength: 5000 })
  @IsString()
  @MinLength(3)
  @MaxLength(5000)
  rejectionReason!: string;

  @ApiPropertyOptional({ maxLength: 5000 })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  adminNotes?: string;
}
