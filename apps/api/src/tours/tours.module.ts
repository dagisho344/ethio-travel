import { Module } from '@nestjs/common';
import { BusinessesModule } from '../businesses/businesses.module';
import { PrismaModule } from '../prisma/prisma.module';
import { MyBusinessToursController } from './tours.controller';
import { ToursService } from './tours.service';

@Module({
  imports: [PrismaModule, BusinessesModule],
  controllers: [MyBusinessToursController],
  providers: [ToursService],
  exports: [ToursService],
})
export class ToursModule {}
