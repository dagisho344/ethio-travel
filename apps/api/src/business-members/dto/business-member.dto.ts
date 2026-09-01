import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { BusinessMemberRole, BusinessMemberStatus } from '@prisma/client';

export class CreateBusinessMemberDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() userId!: string;
  @ApiProperty({ enum: BusinessMemberRole })
  @IsEnum(BusinessMemberRole)
  role!: BusinessMemberRole;
}

export class UpdateBusinessMemberDto {
  @ApiPropertyOptional({ enum: BusinessMemberRole })
  @IsOptional()
  @IsEnum(BusinessMemberRole)
  role?: BusinessMemberRole;
  @ApiPropertyOptional({ enum: BusinessMemberStatus })
  @IsOptional()
  @IsEnum(BusinessMemberStatus)
  status?: BusinessMemberStatus;
}
