import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { UsersModule } from '../users/users.module';
import {
  AdminBusinessesController,
  BusinessesController,
  MyBusinessesController,
} from './businesses.controller';
import { BusinessesService } from './businesses.service';

@Module({
  imports: [PrismaModule, UsersModule],
  controllers: [
    BusinessesController,
    MyBusinessesController,
    AdminBusinessesController,
  ],
  providers: [BusinessesService],
  exports: [BusinessesService],
})
export class BusinessesModule {}
