import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { BusinessStatus, BusinessVerificationSummary } from '@prisma/client';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

export class BusinessQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() category?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() regionSlug?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() citySlug?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() destinationSlug?: string;
}

export class AdminBusinessQueryDto extends BusinessQueryDto {
  @ApiPropertyOptional({ enum: BusinessStatus })
  @IsOptional()
  @IsEnum(BusinessStatus)
  status?: BusinessStatus;
  @ApiPropertyOptional({ enum: BusinessVerificationSummary })
  @IsOptional()
  @IsEnum(BusinessVerificationSummary)
  verificationSummary?: BusinessVerificationSummary;
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  cityId?: string;
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;
}
