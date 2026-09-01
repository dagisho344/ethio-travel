import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminCitiesController, CitiesController } from './cities.controller';
import { CitiesService } from './cities.service';

@Module({
  imports: [PrismaModule],
  controllers: [CitiesController, AdminCitiesController],
  providers: [CitiesService],
  exports: [CitiesService],
})
export class CitiesModule {}
