import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AppConfig } from '../config/app.config';
import { PrismaModule } from '../prisma/prisma.module';
import { DevelopmentStorageProvider } from './development-storage.provider';
import { S3StorageProvider } from './s3-storage.provider';
import { StorageAccessController } from './storage-access.controller';
import { StorageAccessService } from './storage-access.service';
import { STORAGE_PROVIDER, StorageProvider } from './storage.provider';

@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [StorageAccessController],
  providers: [
    StorageAccessService,
    {
      provide: STORAGE_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>): StorageProvider => {
        if (config.get('storageProvider', { infer: true }) === 'S3') {
          return new S3StorageProvider(config);
        }
        return new DevelopmentStorageProvider();
      },
    },
  ],
  exports: [STORAGE_PROVIDER],
})
export class StorageModule {}
