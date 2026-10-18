import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { DestinationBookingConfigController } from './destination-booking-config.controller';
import { DestinationBookingConfigService } from './destination-booking-config.service';

@Module({
  imports: [PrismaModule],
  controllers: [DestinationBookingConfigController],
  providers: [DestinationBookingConfigService],
})
export class DestinationBookingConfigModule {}
