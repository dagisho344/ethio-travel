import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsController } from './notifications.controller';
import { NotificationsEvents } from './notifications.events';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [PrismaModule],
  controllers: [NotificationsController],
  providers: [NotificationsEvents, NotificationsService],
  exports: [NotificationsEvents, NotificationsService],
})
export class NotificationsModule {}
