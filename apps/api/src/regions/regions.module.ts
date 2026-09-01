import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import {
  AdminRegionsController,
  RegionsController,
} from './regions.controller';
import { RegionsService } from './regions.service';

@Module({
  imports: [PrismaModule],
  controllers: [RegionsController, AdminRegionsController],
  providers: [RegionsService],
  exports: [RegionsService],
})
export class RegionsModule {}
