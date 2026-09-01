import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { HealthResponse } from './health.types';

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async check(): Promise<HealthResponse> {
    const [database, redis] = await Promise.all([
      this.prisma.isHealthy(),
      this.redis.isHealthy(),
    ]);

    const status = database && redis ? 'ok' : 'degraded';

    return {
      status,
      services: {
        database: database ? 'up' : 'down',
        redis: redis ? 'up' : 'down',
      },
      timestamp: new Date().toISOString(),
    };
  }
}
