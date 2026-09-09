import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { MessagingController } from './messaging.controller';
import { MessagingEvents } from './messaging.events';
import { MessagingGateway } from './messaging.gateway';
import { MessagingService } from './messaging.service';

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [MessagingController],
  providers: [MessagingEvents, MessagingGateway, MessagingService],
})
export class MessagingModule {}
