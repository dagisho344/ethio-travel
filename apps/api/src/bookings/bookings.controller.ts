import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthenticatedUser } from '../auth/authenticated-user';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AdminOnly } from '../common/utils/admin-only.decorator';
import { BookingsService } from './bookings.service';
import {
  CreateAvailabilityOverrideDto,
  CreateAvailabilityRuleDto,
  UpdateAvailabilityOverrideDto,
  UpdateAvailabilityRuleDto,
  UpsertAvailabilityConfigDto,
} from './dto/availability.dto';
import {
  AvailabilityQueryDto,
  BookingActionDto,
  BookingQueryDto,
  CreateBookingDto,
} from './dto/booking.dto';

@ApiTags('bookings')
@Controller()
export class BookingsController {
  constructor(private readonly service: BookingsService) {}

  @Post('bookings')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiCreatedResponse({ description: 'Booking request created.' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateBookingDto,
  ) {
    return this.service.create(user.sub, dto);
  }

  @Get('users/me/bookings')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOkResponse({
    description: 'Paginated bookings for authenticated traveler.',
  })
  findMine(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: BookingQueryDto,
  ) {
    return this.service.findMine(user.sub, query);
  }

  @Get('users/me/bookings/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOkResponse({ description: 'Authenticated traveler booking detail.' })
  findMineById(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.service.findMineById(user.sub, id);
  }

  @Post('bookings/:id/cancel')
  @HttpCode(200)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOkResponse({ description: 'Authenticated traveler booking cancelled.' })
  cancelMine(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: BookingActionDto,
  ) {
    return this.service.cancelMine(user.sub, id, dto);
  }
}

@ApiTags('business bookings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('businesses/:businessId/bookings')
export class BusinessBookingsController {
  constructor(private readonly service: BookingsService) {}

  @Get()
  @ApiOkResponse({
    description: 'Paginated bookings for an authorized business member.',
  })
  findBusiness(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId', new ParseUUIDPipe()) businessId: string,
    @Query() query: BookingQueryDto,
  ) {
    return this.service.findBusinessBookings(user.sub, businessId, query);
  }

  @Get(':id')
  @ApiOkResponse({ description: 'Business booking detail.' })
  findBusinessById(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId', new ParseUUIDPipe()) businessId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.service.findBusinessBooking(user.sub, businessId, id);
  }

  @Post(':id/confirm')
  @HttpCode(200)
  @ApiOkResponse({ description: 'Business confirms a pending booking.' })
  confirm(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId', new ParseUUIDPipe()) businessId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: BookingActionDto,
  ) {
    return this.service.confirmBusiness(user.sub, businessId, id, dto);
  }

  @Post(':id/reject')
  @HttpCode(200)
  @ApiOkResponse({ description: 'Business rejects a pending booking.' })
  reject(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId', new ParseUUIDPipe()) businessId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: BookingActionDto,
  ) {
    return this.service.rejectBusiness(user.sub, businessId, id, dto);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @ApiOkResponse({ description: 'Business cancels a booking.' })
  cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId', new ParseUUIDPipe()) businessId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: BookingActionDto,
  ) {
    return this.service.cancelBusiness(user.sub, businessId, id, dto);
  }

  @Post(':id/complete')
  @HttpCode(200)
  @ApiOkResponse({
    description: 'Business marks a confirmed booking completed.',
  })
  complete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId', new ParseUUIDPipe()) businessId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: BookingActionDto,
  ) {
    return this.service.completeBusiness(user.sub, businessId, id, dto);
  }

  @Post(':id/no-show')
  @HttpCode(200)
  @ApiOkResponse({
    description: 'Business marks a confirmed booking no-show.',
  })
  noShow(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId', new ParseUUIDPipe()) businessId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: BookingActionDto,
  ) {
    return this.service.noShowBusiness(user.sub, businessId, id, dto);
  }
}

@ApiTags('service availability')
@Controller('services/:serviceId')
export class ServiceAvailabilityController {
  constructor(private readonly service: BookingsService) {}

  @Get('availability')
  @ApiOkResponse({
    description: 'Public service availability for a requested range.',
  })
  availability(
    @Param('serviceId', new ParseUUIDPipe()) serviceId: string,
    @Query() query: AvailabilityQueryDto,
  ) {
    return this.service.availability(serviceId, query);
  }

  @Get('availability-config')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOkResponse({
    description:
      'Service booking configuration for authorized business member.',
  })
  getConfig(
    @CurrentUser() user: AuthenticatedUser,
    @Param('serviceId', new ParseUUIDPipe()) serviceId: string,
  ) {
    return this.service.getConfig(user.sub, serviceId);
  }

  @Put('availability-config')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOkResponse({ description: 'Service booking configuration updated.' })
  upsertConfig(
    @CurrentUser() user: AuthenticatedUser,
    @Param('serviceId', new ParseUUIDPipe()) serviceId: string,
    @Body() dto: UpsertAvailabilityConfigDto,
  ) {
    return this.service.upsertConfig(user.sub, serviceId, dto);
  }

  @Get('availability-rules')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOkResponse({ description: 'Service availability rules.' })
  rules(
    @CurrentUser() user: AuthenticatedUser,
    @Param('serviceId', new ParseUUIDPipe()) serviceId: string,
  ) {
    return this.service.rules(user.sub, serviceId);
  }

  @Post('availability-rules')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiCreatedResponse({ description: 'Service availability rule created.' })
  createRule(
    @CurrentUser() user: AuthenticatedUser,
    @Param('serviceId', new ParseUUIDPipe()) serviceId: string,
    @Body() dto: CreateAvailabilityRuleDto,
  ) {
    return this.service.createRule(user.sub, serviceId, dto);
  }

  @Patch('availability-rules/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOkResponse({ description: 'Service availability rule updated.' })
  updateRule(
    @CurrentUser() user: AuthenticatedUser,
    @Param('serviceId', new ParseUUIDPipe()) serviceId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateAvailabilityRuleDto,
  ) {
    return this.service.updateRule(user.sub, serviceId, id, dto);
  }

  @Delete('availability-rules/:id')
  @HttpCode(204)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiNoContentResponse({ description: 'Service availability rule removed.' })
  deleteRule(
    @CurrentUser() user: AuthenticatedUser,
    @Param('serviceId', new ParseUUIDPipe()) serviceId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.service.deleteRule(user.sub, serviceId, id);
  }

  @Get('availability-overrides')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOkResponse({ description: 'Service availability overrides.' })
  overrides(
    @CurrentUser() user: AuthenticatedUser,
    @Param('serviceId', new ParseUUIDPipe()) serviceId: string,
  ) {
    return this.service.overrides(user.sub, serviceId);
  }

  @Post('availability-overrides')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiCreatedResponse({ description: 'Service availability override created.' })
  createOverride(
    @CurrentUser() user: AuthenticatedUser,
    @Param('serviceId', new ParseUUIDPipe()) serviceId: string,
    @Body() dto: CreateAvailabilityOverrideDto,
  ) {
    return this.service.createOverride(user.sub, serviceId, dto);
  }

  @Patch('availability-overrides/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOkResponse({ description: 'Service availability override updated.' })
  updateOverride(
    @CurrentUser() user: AuthenticatedUser,
    @Param('serviceId', new ParseUUIDPipe()) serviceId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateAvailabilityOverrideDto,
  ) {
    return this.service.updateOverride(user.sub, serviceId, id, dto);
  }

  @Delete('availability-overrides/:id')
  @HttpCode(204)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiNoContentResponse({
    description: 'Service availability override removed.',
  })
  deleteOverride(
    @CurrentUser() user: AuthenticatedUser,
    @Param('serviceId', new ParseUUIDPipe()) serviceId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.service.deleteOverride(user.sub, serviceId, id);
  }
}

@ApiTags('admin bookings')
@AdminOnly()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/bookings')
export class AdminBookingsController {
  constructor(private readonly service: BookingsService) {}

  @Get()
  @ApiOkResponse({
    description: 'Paginated booking inspection for administrators.',
  })
  findAdmin(@Query() query: BookingQueryDto) {
    return this.service.findAdmin(query);
  }
}
