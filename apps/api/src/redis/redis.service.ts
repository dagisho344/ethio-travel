import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { AppConfig } from '../config/app.config';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly client: Redis;

  constructor(config: ConfigService<AppConfig, true>) {
    this.client = new Redis(config.get('redisUrl', { infer: true }), {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });
  }

  onModuleDestroy(): void {
    this.client.disconnect();
  }

  async isHealthy(): Promise<boolean> {
    try {
      if (this.client.status === 'wait') {
        await this.client.connect();
      }
      return (await this.client.ping()) === 'PONG';
    } catch {
      return false;
    }
  }
}
