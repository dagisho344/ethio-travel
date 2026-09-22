import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ServiceCategoryFamily } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

export class ServiceCategoryQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @Type(() => Boolean)
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({ enum: ServiceCategoryFamily })
  @IsEnum(ServiceCategoryFamily)
  @IsOptional()
  family?: ServiceCategoryFamily;
}
