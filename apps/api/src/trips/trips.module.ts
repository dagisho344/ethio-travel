import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import {
  PublicTripShareController,
  TripShareOwnerController,
} from './trip-share.controller';
import { TripShareRateLimiterService } from './trip-share-rate-limiter.service';
import { TripShareService } from './trip-share.service';
import { TripsController } from './trips.controller';
import { TripsService } from './trips.service';

@Module({
  imports: [PrismaModule, RedisModule],
  controllers: [
    TripsController,
    TripShareOwnerController,
    PublicTripShareController,
  ],
  providers: [TripsService, TripShareService, TripShareRateLimiterService],
  exports: [TripsService],
})
export class TripsModule {}
