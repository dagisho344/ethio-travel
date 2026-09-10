import { Module } from '@nestjs/common';
import { BusinessesModule } from '../businesses/businesses.module';
import { PrismaModule } from '../prisma/prisma.module';
import { BusinessLocationHoursService } from './business-location-hours.service';
import { BusinessLocationsController } from './business-locations.controller';
import { BusinessLocationsService } from './business-locations.service';

@Module({
  imports: [PrismaModule, BusinessesModule],
  controllers: [BusinessLocationsController],
  providers: [BusinessLocationsService, BusinessLocationHoursService],
  exports: [BusinessLocationsService, BusinessLocationHoursService],
})
export class BusinessLocationsModule {}
