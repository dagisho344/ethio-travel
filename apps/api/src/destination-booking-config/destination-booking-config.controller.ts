import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
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
import { DestinationBookingConfigService } from './destination-booking-config.service';
import {
  CreateDestinationPaymentAccountDto,
  DestinationPaymentAccountQueryDto,
  EmptyActionDto,
  UpdateDestinationBookingConfigDto,
  UpdateDestinationPaymentAccountDto,
} from './dto/destination-booking-config.dto';

function auditContext(request: Request) {
  return {
    correlationId: typeof request.id === 'string' ? request.id : undefined,
    ipAddress: request.ip,
    userAgent: request.headers['user-agent'],
  };
}

@ApiTags('admin destination booking configuration')
@ApiBearerAuth()
@AdminOnly()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/destinations/:destinationId')
export class DestinationBookingConfigController {
  constructor(private readonly service: DestinationBookingConfigService) {}

  @Get('booking-config')
  @ApiOkResponse({
    description: 'Admin-only Destination booking configuration.',
  })
  getConfig(
    @Param('destinationId', new ParseUUIDPipe()) destinationId: string,
  ) {
    return this.service.getConfig(destinationId);
  }

  @Put('booking-config')
  @ApiOkResponse({
    description: 'Saves ETB Destination booking-request configuration.',
  })
  updateConfig(
    @CurrentUser() user: AuthenticatedUser,
    @Param('destinationId', new ParseUUIDPipe()) destinationId: string,
    @Body() dto: UpdateDestinationBookingConfigDto,
    @Req() request: Request,
  ) {
    return this.service.updateConfig(
      destinationId,
      user.sub,
      dto,
      auditContext(request),
    );
  }

  @Get('payment-accounts')
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ description: 'Paginated Admin-only payment accounts.' })
  listAccounts(
    @Param('destinationId', new ParseUUIDPipe()) destinationId: string,
    @Query() query: DestinationPaymentAccountQueryDto,
  ) {
    return this.service.listAccounts(destinationId, query);
  }

  @Post('payment-accounts')
  @Header('Cache-Control', 'no-store')
  @ApiCreatedResponse({
    description: 'Destination-specific payment account created.',
  })
  createAccount(
    @CurrentUser() user: AuthenticatedUser,
    @Param('destinationId', new ParseUUIDPipe()) destinationId: string,
    @Body() dto: CreateDestinationPaymentAccountDto,
    @Req() request: Request,
  ) {
    return this.service.createAccount(
      destinationId,
      user.sub,
      dto,
      auditContext(request),
    );
  }

  @Patch('payment-accounts/:accountId')
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ description: 'Destination-scoped payment account updated.' })
  updateAccount(
    @CurrentUser() user: AuthenticatedUser,
    @Param('destinationId', new ParseUUIDPipe()) destinationId: string,
    @Param('accountId', new ParseUUIDPipe()) accountId: string,
    @Body() dto: UpdateDestinationPaymentAccountDto,
    @Req() request: Request,
  ) {
    return this.service.updateAccount(
      destinationId,
      accountId,
      user.sub,
      dto,
      auditContext(request),
    );
  }

  @Post('payment-accounts/:accountId/deactivate')
  @Header('Cache-Control', 'no-store')
  @HttpCode(200)
  @ApiOkResponse({ description: 'Destination-scoped account deactivated.' })
  deactivateAccount(
    @CurrentUser() user: AuthenticatedUser,
    @Param('destinationId', new ParseUUIDPipe()) destinationId: string,
    @Param('accountId', new ParseUUIDPipe()) accountId: string,
    @Body() _body: EmptyActionDto,
    @Req() request: Request,
  ) {
    return this.service.deactivateAccount(
      destinationId,
      accountId,
      user.sub,
      auditContext(request),
    );
  }
}
