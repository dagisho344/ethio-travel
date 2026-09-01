import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Server } from 'node:http';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';

interface HealthBody {
  status: string;
}

describe('Health endpoint', () => {
  let app: INestApplication | undefined;
  let httpServer: Server;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.JWT_ACCESS_SECRET =
      'test-secret-with-at-least-thirty-two-characters';
    process.env.DATABASE_URL =
      process.env.DATABASE_URL ??
      'postgresql://ethiotravel:ethiotravel@localhost:5432/ethiotravel?schema=public';
    process.env.REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({ isHealthy: () => Promise.resolve(true) })
      .overrideProvider(RedisService)
      .useValue({ isHealthy: () => Promise.resolve(true) })
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
    httpServer = app.getHttpServer() as Server;
  });

  afterAll(async () => {
    await app?.close();
  });

  it('/api/v1/health (GET)', async () => {
    await request(httpServer)
      .get('/api/v1/health')
      .expect(200)
      .expect(({ body }: { body: HealthBody }) => {
        expect(body.status).toBe('ok');
      });
  });
});
