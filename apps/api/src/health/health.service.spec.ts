import { HealthService } from './health.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

describe('HealthService', () => {
  it('returns ok when dependencies are healthy', async () => {
    const service = new HealthService(
      { isHealthy: () => Promise.resolve(true) } as PrismaService,
      { isHealthy: () => Promise.resolve(true) } as RedisService,
    );

    await expect(service.check()).resolves.toMatchObject({
      services: { database: 'up', redis: 'up' },
      status: 'ok',
    });
  });

  it('returns degraded when a dependency is down', async () => {
    const service = new HealthService(
      { isHealthy: () => Promise.resolve(true) } as PrismaService,
      { isHealthy: () => Promise.resolve(false) } as RedisService,
    );

    await expect(service.check()).resolves.toMatchObject({
      services: { database: 'up', redis: 'down' },
      status: 'degraded',
    });
  });
});
