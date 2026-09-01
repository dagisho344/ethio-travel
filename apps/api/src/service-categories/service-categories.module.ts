import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import {
  ServiceCategoriesController,
  AdminServiceCategoriesController,
} from './service-categories.controller';
import { ServiceCategoriesService } from './service-categories.service';

@Module({
  imports: [PrismaModule],
  controllers: [ServiceCategoriesController, AdminServiceCategoriesController],
  providers: [ServiceCategoriesService],
  exports: [ServiceCategoriesService],
})
export class ServiceCategoriesModule {}
