import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Server } from 'node:http';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AuthenticatedUser } from '../src/auth/authenticated-user';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import { TripShareService } from '../src/trips/trip-share.service';

const tripId = '33333333-3333-4333-8333-333333333333';
const user: AuthenticatedUser = {
  sub: '11111111-1111-4111-8111-111111111111',
  email: 'traveler@example.com',
  roles: ['TRAVELER'],
  sessionId: 'session',
};
let allowAuth = true;

class TestJwtGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    if (!allowAuth) throw new UnauthorizedException();
    context.switchToHttp().getRequest<{ user: AuthenticatedUser }>().user =
      user;
    return true;
  }
}

describe('Phase 16C trip-share routes', () => {
  let app: INestApplication | undefined;
  let server: Server;
  const shares = {
    create: jest
      .fn()
      .mockResolvedValue({ token: 'a'.repeat(64), expiresAt: null }),
    findOwnerShare: jest.fn().mockResolvedValue({ state: 'NONE' }),
    preview: jest.fn().mockResolvedValue({
      title: 'Preview',
      days: [],
      destinations: [],
      truncated: false,
    }),
    regenerate: jest
      .fn()
      .mockResolvedValue({ token: 'b'.repeat(64), expiresAt: null }),
    updateExpiration: jest.fn().mockResolvedValue({ state: 'ACTIVE' }),
    revoke: jest.fn().mockResolvedValue(undefined),
    resolve: jest.fn().mockResolvedValue({
      title: 'Public itinerary',
      startDate: '2030-06-10',
      endDate: '2030-06-11',
      destinations: [],
      days: [],
      truncated: false,
    }),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({ isHealthy: () => Promise.resolve(true) })
      .overrideProvider(RedisService)
      .useValue({ isHealthy: () => Promise.resolve(true) })
      .overrideProvider(TripShareService)
      .useValue(shares)
      .overrideGuard(JwtAuthGuard)
      .useClass(TestJwtGuard)
      .compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    server = app.getHttpServer() as Server;
  });

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(() => {
    allowAuth = true;
    jest.clearAllMocks();
  });

  it('enforces JWT ownership routes and forwards the authenticated owner', async () => {
    await request(server).get(`/api/v1/trips/${tripId}/share`).expect(200);
    await request(server)
      .post(`/api/v1/trips/${tripId}/share`)
      .send({ expiresAt: '2031-01-01T00:00:00.000Z' })
      .expect(201);
    await request(server)
      .patch(`/api/v1/trips/${tripId}/share`)
      .send({ expiresAt: null })
      .expect(200);
    await request(server)
      .post(`/api/v1/trips/${tripId}/share/regenerate`)
      .send({})
      .expect(201);
    await request(server)
      .post(`/api/v1/trips/${tripId}/share/revoke`)
      .expect(204);
    expect(shares.create).toHaveBeenCalledWith(
      user.sub,
      tripId,
      expect.objectContaining({ expiresAt: '2031-01-01T00:00:00.000Z' }),
    );
    expect(shares.updateExpiration).toHaveBeenCalledWith(
      user.sub,
      tripId,
      expect.objectContaining({ expiresAt: null }),
    );
    allowAuth = false;
    await request(server).get(`/api/v1/trips/${tripId}/share`).expect(401);
  });

  it('rejects malformed owner input and IDs without reaching the service', async () => {
    await request(server)
      .post(`/api/v1/trips/${tripId}/share`)
      .send({ expiresAt: 123, unexpected: true })
      .expect(400);
    await request(server).get('/api/v1/trips/not-a-uuid/share').expect(400);
    expect(shares.create).not.toHaveBeenCalled();
  });

  it('allows credential-free resolution but validates the fixed token body and privacy headers', async () => {
    allowAuth = false;
    const response = await request(server)
      .post('/api/v1/trip-shares/resolve')
      .send({ token: 'a'.repeat(64) })
      .expect(200);
    expect(response.headers['cache-control']).toContain('no-store');
    expect(response.headers['referrer-policy']).toBe('no-referrer');
    expect(response.headers['x-robots-tag']).toContain('noindex');
    await request(server)
      .post('/api/v1/trip-shares/resolve')
      .send({ token: 'not-a-token', extra: true })
      .expect(400);
  });
});
