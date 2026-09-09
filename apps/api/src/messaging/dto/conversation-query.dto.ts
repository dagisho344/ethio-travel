import { ApiPropertyOptional } from '@nestjs/swagger';
import { ConversationStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

export class ConversationQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ConversationStatus })
  @IsEnum(ConversationStatus)
  @IsOptional()
  status?: ConversationStatus;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsUUID()
  @IsOptional()
  businessId?: string;
}

export class MessageQueryDto extends PaginationQueryDto {}
