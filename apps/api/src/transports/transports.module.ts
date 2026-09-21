import { Module } from '@nestjs/common';
import { BusinessesModule } from '../businesses/businesses.module';
import { PrismaModule } from '../prisma/prisma.module';
import { MyBusinessTransportsController } from './transports.controller';
import { TransportsService } from './transports.service';

@Module({
  imports: [PrismaModule, BusinessesModule],
  controllers: [MyBusinessTransportsController],
  providers: [TransportsService],
  exports: [TransportsService],
})
export class TransportsModule {}
