import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  Matches,
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

export class UpdatePlatformSettingsDto {
  @ApiPropertyOptional({
    description:
      'Public platform support email. This must never contain a credential.',
    maxLength: 254,
    nullable: true,
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  supportEmail?: string | null;

  @ApiPropertyOptional({
    description: 'Public platform support phone number.',
    maxLength: 50,
    nullable: true,
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Matches(/^[0-9+(). -]{7,50}$/)
  supportPhone?: string | null;

  @ApiPropertyOptional({
    description: 'Bounded public support message. Never use this for secrets.',
    maxLength: 500,
    nullable: true,
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsOptional()
  @IsString()
  @MaxLength(500)
  supportMessage?: string | null;
}
