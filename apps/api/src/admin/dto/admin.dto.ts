import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { UserStatus } from '@prisma/client';
import { ROLE_NAMES, RoleName } from '../../auth/roles.constants';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

export class AdminActionReasonDto {
  @ApiProperty({ minLength: 3, maxLength: 1000 })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  reason!: string;
}

export class AdminUsersQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: UserStatus })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @ApiPropertyOptional({ enum: ROLE_NAMES })
  @IsOptional()
  @IsIn(ROLE_NAMES)
  role?: RoleName;

  @ApiPropertyOptional({ enum: ['createdAt', 'email', 'status'] })
  @IsOptional()
  @IsIn(['createdAt', 'email', 'status'])
  sort: 'createdAt' | 'email' | 'status' = 'createdAt';

  @ApiPropertyOptional({ enum: ['asc', 'desc'] })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  order: 'asc' | 'desc' = 'desc';
}
