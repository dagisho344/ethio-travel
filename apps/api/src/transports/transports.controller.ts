import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthenticatedUser } from '../auth/authenticated-user';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  CreateTransportRouteDto,
  CreateTransportScheduleDto,
  UpdateTransportDetailDto,
  UpdateTransportRouteDto,
  UpdateTransportScheduleDto,
} from './dto/transport.dto';
import { TransportsService } from './transports.service';

@ApiTags('my business transport')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('my/businesses/:businessId/services/:serviceId/transport')
export class MyBusinessTransportsController {
  constructor(private readonly transports: TransportsService) {}

  @Get()
  @ApiOkResponse({
    description: 'Transport configuration for an authorized member.',
  })
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId', new ParseUUIDPipe({ version: '4' }))
    businessId: string,
    @Param('serviceId', new ParseUUIDPipe({ version: '4' })) serviceId: string,
  ) {
    return this.transports.findMine(user.sub, businessId, serviceId);
  }

  @Patch()
  @ApiOkResponse({
    description: 'Transport details updated by an owner or manager.',
  })
  updateDetail(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId', new ParseUUIDPipe({ version: '4' }))
    businessId: string,
    @Param('serviceId', new ParseUUIDPipe({ version: '4' })) serviceId: string,
    @Body() dto: UpdateTransportDetailDto,
  ) {
    return this.transports.updateDetail(user.sub, businessId, serviceId, dto);
  }

  @Get('routes')
  @ApiOkResponse({ description: 'Transport routes for an authorized member.' })
  listRoutes(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId', new ParseUUIDPipe({ version: '4' }))
    businessId: string,
    @Param('serviceId', new ParseUUIDPipe({ version: '4' })) serviceId: string,
  ) {
    return this.transports.listRoutes(user.sub, businessId, serviceId);
  }

  @Post('routes')
  @ApiCreatedResponse({ description: 'Transport route created.' })
  createRoute(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId', new ParseUUIDPipe({ version: '4' }))
    businessId: string,
    @Param('serviceId', new ParseUUIDPipe({ version: '4' })) serviceId: string,
    @Body() dto: CreateTransportRouteDto,
  ) {
    return this.transports.createRoute(user.sub, businessId, serviceId, dto);
  }

  @Patch('routes/:routeId')
  @ApiOkResponse({ description: 'Transport route updated.' })
  updateRoute(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId', new ParseUUIDPipe({ version: '4' }))
    businessId: string,
    @Param('serviceId', new ParseUUIDPipe({ version: '4' })) serviceId: string,
    @Param('routeId', new ParseUUIDPipe({ version: '4' })) routeId: string,
    @Body() dto: UpdateTransportRouteDto,
  ) {
    return this.transports.updateRoute(
      user.sub,
      businessId,
      serviceId,
      routeId,
      dto,
    );
  }

  @Get('routes/:routeId/schedules')
  @ApiOkResponse({
    description: 'Transport schedules for an authorized member.',
  })
  listSchedules(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId', new ParseUUIDPipe({ version: '4' }))
    businessId: string,
    @Param('serviceId', new ParseUUIDPipe({ version: '4' })) serviceId: string,
    @Param('routeId', new ParseUUIDPipe({ version: '4' })) routeId: string,
  ) {
    return this.transports.listSchedules(
      user.sub,
      businessId,
      serviceId,
      routeId,
    );
  }

  @Post('routes/:routeId/schedules')
  @ApiCreatedResponse({ description: 'Transport schedule created.' })
  createSchedule(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId', new ParseUUIDPipe({ version: '4' }))
    businessId: string,
    @Param('serviceId', new ParseUUIDPipe({ version: '4' })) serviceId: string,
    @Param('routeId', new ParseUUIDPipe({ version: '4' })) routeId: string,
    @Body() dto: CreateTransportScheduleDto,
  ) {
    return this.transports.createSchedule(
      user.sub,
      businessId,
      serviceId,
      routeId,
      dto,
    );
  }

  @Patch('routes/:routeId/schedules/:scheduleId')
  @ApiOkResponse({ description: 'Transport schedule updated.' })
  updateSchedule(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId', new ParseUUIDPipe({ version: '4' }))
    businessId: string,
    @Param('serviceId', new ParseUUIDPipe({ version: '4' })) serviceId: string,
    @Param('routeId', new ParseUUIDPipe({ version: '4' })) routeId: string,
    @Param('scheduleId', new ParseUUIDPipe({ version: '4' }))
    scheduleId: string,
    @Body() dto: UpdateTransportScheduleDto,
  ) {
    return this.transports.updateSchedule(
      user.sub,
      businessId,
      serviceId,
      routeId,
      scheduleId,
      dto,
    );
  }

  @Post('routes/:routeId/schedules/:scheduleId/activate')
  @HttpCode(200)
  @ApiOkResponse({ description: 'Transport schedule activated.' })
  activateSchedule(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId', new ParseUUIDPipe({ version: '4' }))
    businessId: string,
    @Param('serviceId', new ParseUUIDPipe({ version: '4' })) serviceId: string,
    @Param('routeId', new ParseUUIDPipe({ version: '4' })) routeId: string,
    @Param('scheduleId', new ParseUUIDPipe({ version: '4' }))
    scheduleId: string,
  ) {
    return this.transports.setScheduleActive(
      user.sub,
      businessId,
      serviceId,
      routeId,
      scheduleId,
      true,
    );
  }

  @Post('routes/:routeId/schedules/:scheduleId/deactivate')
  @HttpCode(200)
  @ApiOkResponse({
    description: 'Transport schedule deactivated without deletion.',
  })
  deactivateSchedule(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId', new ParseUUIDPipe({ version: '4' }))
    businessId: string,
    @Param('serviceId', new ParseUUIDPipe({ version: '4' })) serviceId: string,
    @Param('routeId', new ParseUUIDPipe({ version: '4' })) routeId: string,
    @Param('scheduleId', new ParseUUIDPipe({ version: '4' }))
    scheduleId: string,
  ) {
    return this.transports.setScheduleActive(
      user.sub,
      businessId,
      serviceId,
      routeId,
      scheduleId,
      false,
    );
  }
}
