import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { AuthenticatedUser } from '../auth/authenticated-user';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AdminOnly } from '../common/utils/admin-only.decorator';
import { AdminService } from './admin.service';
import {
  AdminActionReasonDto,
  AdminUsersQueryDto,
  UpdatePlatformSettingsDto,
} from './dto/admin.dto';

function auditContext(request: Request) {
  return {
    correlationId: typeof request.id === 'string' ? request.id : undefined,
    ipAddress: request.ip,
    userAgent: request.headers['user-agent'],
  };
}

@ApiTags('admin')
@ApiBearerAuth()
@AdminOnly()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('dashboard')
  @ApiOkResponse({ description: 'Bounded administrator dashboard summary.' })
  dashboard() {
    return this.admin.dashboard();
  }

  @Get('analytics')
  @ApiOkResponse({
    description: 'Bounded administrator analytics from database aggregates.',
  })
  analytics() {
    return this.admin.analytics();
  }

  @Get('settings')
  @ApiOkResponse({ description: 'Safe, non-secret platform settings.' })
  settings() {
    return this.admin.settings();
  }

  @Patch('settings')
  @ApiOkResponse({
    description: 'Updates typed non-secret platform support settings.',
  })
  updateSettings(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: UpdatePlatformSettingsDto,
    @Req() request: Request,
  ) {
    return this.admin.updateSettings(actor, dto, auditContext(request));
  }

  @Get('users')
  @ApiOkResponse({ description: 'Paginated safe user administration list.' })
  users(@Query() query: AdminUsersQueryDto) {
    return this.admin.listUsers(query);
  }

  @Get('users/:userId')
  @ApiOkResponse({ description: 'Safe administrator user detail.' })
  user(@Param('userId', new ParseUUIDPipe()) userId: string) {
    return this.admin.findUserById(userId);
  }

  @Post('users/:userId/suspend')
  @HttpCode(200)
  @ApiOkResponse({
    description: 'Suspends a user and revokes active sessions.',
  })
  suspendUser(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Body() dto: AdminActionReasonDto,
    @Req() request: Request,
  ) {
    return this.admin.suspendUser(actor, userId, dto, auditContext(request));
  }

  @Post('users/:userId/restore')
  @HttpCode(200)
  @ApiOkResponse({ description: 'Restores a suspended user.' })
  restoreUser(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Body() dto: AdminActionReasonDto,
    @Req() request: Request,
  ) {
    return this.admin.restoreUser(actor, userId, dto, auditContext(request));
  }
}
