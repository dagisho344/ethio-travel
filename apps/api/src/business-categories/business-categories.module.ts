import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import {
  AdminBusinessCategoriesController,
  BusinessCategoriesController,
} from './business-categories.controller';
import { BusinessCategoriesService } from './business-categories.service';

@Module({
  imports: [PrismaModule],
  controllers: [
    BusinessCategoriesController,
    AdminBusinessCategoriesController,
  ],
  providers: [BusinessCategoriesService],
  exports: [BusinessCategoriesService],
})
export class BusinessCategoriesModule {}
