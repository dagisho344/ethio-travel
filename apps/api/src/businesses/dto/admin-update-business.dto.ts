import { ApiPropertyOptional, PartialType, PickType } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { BusinessStatus } from '@prisma/client';
import { CreateBusinessDto } from './create-business.dto';

export class AdminUpdateBusinessDto extends PartialType(CreateBusinessDto) {
  @ApiPropertyOptional({ enum: BusinessStatus })
  @IsOptional()
  @IsEnum(BusinessStatus)
  status?: BusinessStatus;
}

export class PublicBusinessDto extends PickType(CreateBusinessDto, [
  'name',
  'slug',
  'description',
  'phone',
  'email',
  'website',
  'addressLine1',
  'addressLine2',
  'neighborhood',
  'postalCode',
  'latitude',
  'longitude',
] as const) {}
