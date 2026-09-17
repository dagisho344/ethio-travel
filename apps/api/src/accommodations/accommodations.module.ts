import { Module } from '@nestjs/common';
import { BusinessesModule } from '../businesses/businesses.module';
import { PrismaModule } from '../prisma/prisma.module';
import { MyBusinessAccommodationController } from './accommodations.controller';
import { AccommodationService } from './accommodations.service';

@Module({
  imports: [PrismaModule, BusinessesModule],
  controllers: [MyBusinessAccommodationController],
  providers: [AccommodationService],
  exports: [AccommodationService],
})
export class AccommodationsModule {}
