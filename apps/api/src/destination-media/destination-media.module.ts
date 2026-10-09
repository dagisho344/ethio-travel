import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { DestinationMediaController } from './destination-media.controller';
import { DestinationMediaService } from './destination-media.service';

@Module({
  imports: [PrismaModule, StorageModule],
  controllers: [DestinationMediaController],
  providers: [DestinationMediaService],
})
export class DestinationMediaModule {}
