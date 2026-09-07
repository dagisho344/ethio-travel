import { Module } from '@nestjs/common';
import { BusinessesModule } from '../businesses/businesses.module';
import { PrismaModule } from '../prisma/prisma.module';
import {
  BookingsController,
  BusinessBookingsController,
  ServiceAvailabilityController,
  AdminBookingsController,
} from './bookings.controller';
import { BookingsService } from './bookings.service';

@Module({
  imports: [PrismaModule, BusinessesModule],
  controllers: [
    BookingsController,
    BusinessBookingsController,
    ServiceAvailabilityController,
    AdminBookingsController,
  ],
  providers: [BookingsService],
})
export class BookingsModule {}
