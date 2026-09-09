import { Module } from '@nestjs/common';
import { BusinessesModule } from '../businesses/businesses.module';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PAYMENT_GATEWAY } from './payment-gateway';
import {
  AdminPaymentsController,
  BusinessPaymentsController,
  PaymentsController,
} from './payments.controller';
import { PaymentsService } from './payments.service';
import { DevelopmentPaymentGateway } from './providers/development-payment.gateway';

@Module({
  imports: [PrismaModule, BusinessesModule, NotificationsModule],
  controllers: [
    PaymentsController,
    BusinessPaymentsController,
    AdminPaymentsController,
  ],
  providers: [
    PaymentsService,
    DevelopmentPaymentGateway,
    { provide: PAYMENT_GATEWAY, useExisting: DevelopmentPaymentGateway },
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}
