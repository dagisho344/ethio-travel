import { ApiPropertyOptional, PickType } from '@nestjs/swagger';
import { EditorialLocale } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

export class PublicRegionQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: EditorialLocale })
  @IsOptional()
  @IsEnum(EditorialLocale)
  locale?: EditorialLocale;
}

export class RegionLocaleQueryDto extends PickType(PublicRegionQueryDto, [
  'locale',
] as const) {}
