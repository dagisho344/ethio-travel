import { Module } from '@nestjs/common';
import { BusinessesModule } from '../businesses/businesses.module';
import { PrismaModule } from '../prisma/prisma.module';
import { MyBusinessRestaurantsController } from './restaurants.controller';
import { RestaurantsService } from './restaurants.service';

@Module({
  imports: [PrismaModule, BusinessesModule],
  controllers: [MyBusinessRestaurantsController],
  providers: [RestaurantsService],
  exports: [RestaurantsService],
})
export class RestaurantsModule {}
