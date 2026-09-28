import { ApiPropertyOptional } from '@nestjs/swagger';
import { EditorialLocale } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

export class PublicDestinationQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: EditorialLocale })
  @IsOptional()
  @IsEnum(EditorialLocale)
  locale?: EditorialLocale;
}
