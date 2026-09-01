import { Module } from '@nestjs/common';
import { BusinessesModule } from '../businesses/businesses.module';
import { PrismaModule } from '../prisma/prisma.module';
import {
  AdminServicesController,
  MyBusinessServicesController,
  ServicesController,
} from './services.controller';
import { ServicesService } from './services.service';

@Module({
  imports: [PrismaModule, BusinessesModule],
  controllers: [
    ServicesController,
    MyBusinessServicesController,
    AdminServicesController,
  ],
  providers: [ServicesService],
})
export class ServicesModule {}
