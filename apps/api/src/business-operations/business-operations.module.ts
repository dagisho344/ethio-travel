import { Module } from '@nestjs/common';
import { BusinessesModule } from '../businesses/businesses.module';
import { PrismaModule } from '../prisma/prisma.module';
import { BusinessOperationsController } from './business-operations.controller';
import { BusinessOperationsService } from './business-operations.service';

@Module({
  imports: [PrismaModule, BusinessesModule],
  controllers: [BusinessOperationsController],
  providers: [BusinessOperationsService],
})
export class BusinessOperationsModule {}
