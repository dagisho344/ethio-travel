import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsIn, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from '../audit.constants';

const auditActions = Object.values(AUDIT_ACTIONS);
const auditEntityTypes = Object.values(AUDIT_ENTITY_TYPES);

export class AuditQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: auditActions })
  @IsOptional()
  @IsIn(auditActions)
  action?: string;

  @ApiPropertyOptional({ enum: auditEntityTypes })
  @IsOptional()
  @IsIn(auditEntityTypes)
  entityType?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  entityId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  actorUserId?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  from?: Date;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  to?: Date;
}
