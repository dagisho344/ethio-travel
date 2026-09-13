import { Module } from '@nestjs/common';
import { BusinessesModule } from '../businesses/businesses.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import {
  AdminBusinessVerificationsController,
  MyBusinessVerificationsController,
} from './business-verifications.controller';
import { BusinessVerificationsService } from './business-verifications.service';

@Module({
  imports: [PrismaModule, BusinessesModule, NotificationsModule, StorageModule],
  controllers: [
    MyBusinessVerificationsController,
    AdminBusinessVerificationsController,
  ],
  providers: [BusinessVerificationsService],
  exports: [BusinessVerificationsService],
})
export class BusinessVerificationsModule {}
