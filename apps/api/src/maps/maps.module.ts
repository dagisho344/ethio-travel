import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MapsController } from './maps.controller';
import { MapsService } from './maps.service';

@Module({
  imports: [PrismaModule],
  controllers: [MapsController],
  providers: [MapsService],
})
export class MapsModule {}
