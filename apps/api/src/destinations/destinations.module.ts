import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import {
  AdminDestinationsController,
  DestinationsController,
} from './destinations.controller';
import { DestinationsService } from './destinations.service';

@Module({
  imports: [PrismaModule],
  controllers: [DestinationsController, AdminDestinationsController],
  providers: [DestinationsService],
  exports: [DestinationsService],
})
export class DestinationsModule {}
