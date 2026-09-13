import { Module } from '@nestjs/common';
import { BusinessesModule } from '../businesses/businesses.module';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { BusinessMediaController } from './business-media.controller';
import { BusinessMediaService } from './business-media.service';
@Module({
  imports: [PrismaModule, BusinessesModule, StorageModule],
  controllers: [BusinessMediaController],
  providers: [BusinessMediaService],
  exports: [BusinessMediaService],
})
export class BusinessMediaModule {}
