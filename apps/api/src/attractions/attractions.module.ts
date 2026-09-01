import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import {
  AdminAttractionsController,
  AttractionsController,
} from './attractions.controller';
import { AttractionsService } from './attractions.service';

@Module({
  imports: [PrismaModule],
  controllers: [AttractionsController, AdminAttractionsController],
  providers: [AttractionsService],
  exports: [AttractionsService],
})
export class AttractionsModule {}
