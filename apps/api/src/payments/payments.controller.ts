import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
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
import { RolesGuard } from '../auth/guards/roles.guard';
import { AdminOnly } from '../common/utils/admin-only.decorator';
import {
  CreatePaymentDto,
  PaymentQueryDto,
  RefundPaymentDto,
} from './dto/payment.dto';
import { PaymentsService } from './payments.service';

@ApiTags('payments')
@Controller()
export class PaymentsController {
  constructor(private readonly service: PaymentsService) {}

  @Post('bookings/:bookingId/payments')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiCreatedResponse({ description: 'Payment initiated for a booking.' })
  createForBooking(
    @CurrentUser() user: AuthenticatedUser,
    @Param('bookingId', new ParseUUIDPipe()) bookingId: string,
    @Body() dto: CreatePaymentDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.service.createForBooking(
      user.sub,
      bookingId,
      dto,
      idempotencyKey,
    );
  }

  @Get('bookings/:bookingId/payments')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOkResponse({ description: 'Paginated payments for owned booking.' })
  findForBooking(
    @CurrentUser() user: AuthenticatedUser,
    @Param('bookingId', new ParseUUIDPipe()) bookingId: string,
    @Query() query: PaymentQueryDto,
  ) {
    return this.service.findForBooking(user.sub, bookingId, query);
  }

  @Get('payments/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOkResponse({ description: 'Payment detail for authenticated owner.' })
  findMineById(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.service.findMineById(user.sub, id);
  }

  @Post('payments/webhooks/:provider')
  @HttpCode(200)
  @ApiOkResponse({ description: 'Provider payment webhook accepted.' })
  webhook(
    @Param('provider') provider: string,
    @Body() payload: unknown,
    @Headers('x-ethiotravel-signature') signature?: string,
  ) {
    return this.service.processWebhook(provider, payload, signature);
  }
}

@ApiTags('business payments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('businesses/:businessId/payments')
export class BusinessPaymentsController {
  constructor(private readonly service: PaymentsService) {}

  @Get()
  @ApiOkResponse({ description: 'Paginated business payments.' })
  findBusiness(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId', new ParseUUIDPipe()) businessId: string,
    @Query() query: PaymentQueryDto,
  ) {
    return this.service.findBusiness(user.sub, businessId, query);
  }

  @Get(':paymentId')
  @ApiOkResponse({ description: 'Business payment detail.' })
  findBusinessById(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId', new ParseUUIDPipe()) businessId: string,
    @Param('paymentId', new ParseUUIDPipe()) paymentId: string,
  ) {
    return this.service.findBusinessById(user.sub, businessId, paymentId);
  }
}

@ApiTags('admin payments')
@AdminOnly()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/payments')
export class AdminPaymentsController {
  constructor(private readonly service: PaymentsService) {}

  @Get()
  @ApiOkResponse({ description: 'Paginated payment inspection.' })
  findAdmin(@Query() query: PaymentQueryDto) {
    return this.service.findAdmin(query);
  }

  @Get(':id')
  @ApiOkResponse({ description: 'Payment inspection detail.' })
  findAdminById(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.findAdminById(id);
  }

  @Post(':id/refund')
  @HttpCode(200)
  @ApiOkResponse({ description: 'Admin refund for a paid payment.' })
  refund(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: RefundPaymentDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.service.refund(id, dto, idempotencyKey);
  }
}
