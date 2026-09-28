import { ApiPropertyOptional } from '@nestjs/swagger';
import { EditorialLocale } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';

export class DestinationLocaleQueryDto {
  @ApiPropertyOptional({ enum: EditorialLocale })
  @IsOptional()
  @IsEnum(EditorialLocale)
  locale?: EditorialLocale;
}
