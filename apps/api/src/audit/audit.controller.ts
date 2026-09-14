import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AdminOnly } from '../common/utils/admin-only.decorator';
import { AuditService } from './audit.service';
import { AuditQueryDto } from './dto/audit-query.dto';

@ApiTags('admin audit')
@ApiBearerAuth()
@AdminOnly()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/audit')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @ApiOkResponse({ description: 'Append-only administrative audit records.' })
  list(@Query() query: AuditQueryDto) {
    return this.audit.list(query);
  }
}
