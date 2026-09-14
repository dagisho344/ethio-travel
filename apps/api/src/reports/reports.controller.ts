import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { AuthenticatedUser } from '../auth/authenticated-user';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AdminOnly } from '../common/utils/admin-only.decorator';
import { AdminReportQueryDto } from './dto/admin-report-query.dto';
import { AdminReportResolutionDto } from './dto/admin-report-resolution.dto';
import { CreateReportDto } from './dto/create-report.dto';
import { ReportsService } from './reports.service';

function auditContext(request: Request) {
  return {
    correlationId: typeof request.id === 'string' ? request.id : undefined,
    ipAddress: request.ip,
    userAgent: request.headers['user-agent'],
  };
}

@ApiTags('reports')
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiCreatedResponse({ description: 'A report was submitted for review.' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateReportDto) {
    return this.reports.create(user.sub, dto);
  }
}

@ApiTags('admin reports')
@ApiBearerAuth()
@AdminOnly()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin')
export class AdminReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('reports')
  @ApiOkResponse({ description: 'Paginated administrator report queue.' })
  list(@Query() query: AdminReportQueryDto) {
    return this.reports.listAdmin(query);
  }

  @Get('reports/:reportId')
  @ApiOkResponse({ description: 'Safe administrator report detail.' })
  detail(@Param('reportId', new ParseUUIDPipe()) reportId: string) {
    return this.reports.findAdminById(reportId);
  }

  @Post('reports/:reportId/start-review')
  @HttpCode(200)
  @ApiOkResponse({ description: 'Marks an open report as under review.' })
  startReview(
    @CurrentUser() user: AuthenticatedUser,
    @Param('reportId', new ParseUUIDPipe()) reportId: string,
    @Req() request: Request,
  ) {
    return this.reports.startReview(reportId, user.sub, auditContext(request));
  }

  @Post('reports/:reportId/resolve')
  @HttpCode(200)
  @ApiOkResponse({ description: 'Resolves a report with an auditable note.' })
  resolve(
    @CurrentUser() user: AuthenticatedUser,
    @Param('reportId', new ParseUUIDPipe()) reportId: string,
    @Body() dto: AdminReportResolutionDto,
    @Req() request: Request,
  ) {
    return this.reports.resolve(reportId, user.sub, dto, auditContext(request));
  }

  @Post('reports/:reportId/dismiss')
  @HttpCode(200)
  @ApiOkResponse({ description: 'Dismisses a report with an auditable note.' })
  dismiss(
    @CurrentUser() user: AuthenticatedUser,
    @Param('reportId', new ParseUUIDPipe()) reportId: string,
    @Body() dto: AdminReportResolutionDto,
    @Req() request: Request,
  ) {
    return this.reports.dismiss(reportId, user.sub, dto, auditContext(request));
  }

  @Get('moderation')
  @ApiOkResponse({ description: 'Bounded content moderation summary.' })
  moderation() {
    return this.reports.moderationSummary();
  }
}
