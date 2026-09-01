import { Module } from '@nestjs/common';
import { BusinessesModule } from '../businesses/businesses.module';
import { PrismaModule } from '../prisma/prisma.module';
import {
  AdminBusinessVerificationsController,
  MyBusinessVerificationsController,
} from './business-verifications.controller';
import { BusinessVerificationsService } from './business-verifications.service';

@Module({
  imports: [PrismaModule, BusinessesModule],
  controllers: [
    MyBusinessVerificationsController,
    AdminBusinessVerificationsController,
  ],
  providers: [BusinessVerificationsService],
})
export class BusinessVerificationsModule {}
