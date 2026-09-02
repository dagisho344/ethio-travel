import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { FavoriteTargetType } from './favorite-target-type.enum';

export class FavoriteQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: FavoriteTargetType })
  @IsEnum(FavoriteTargetType)
  @IsOptional()
  targetType?: FavoriteTargetType;
}
