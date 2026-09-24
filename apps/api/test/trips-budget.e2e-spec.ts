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
import { TripsService } from '../src/trips/trips.service';

const tripId = '33333333-3333-4333-8333-333333333333';
let allowAuth = true;
const user: AuthenticatedUser = {
  sub: '11111111-1111-4111-8111-111111111111',
  email: 'traveler@example.com',
  roles: ['TRAVELER'],
  sessionId: 'session',
};
class TestJwtGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    if (!allowAuth) throw new UnauthorizedException();
    context.switchToHttp().getRequest<{ user: AuthenticatedUser }>().user =
      user;
    return true;
  }
}

describe('Phase 16B trip budget routes', () => {
  let app: INestApplication | undefined;
  let httpServer: Server;
  const budget = jest.fn().mockResolvedValue(null);
  const upsertBudget = jest
    .fn()
    .mockResolvedValue({ amount: '1000.00', currency: 'ETB', expenses: [] });
  const createPlannedExpense = jest
    .fn()
    .mockResolvedValue({ amount: '1000.00', currency: 'ETB', expenses: [] });
  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({ isHealthy: () => Promise.resolve(true) })
      .overrideProvider(RedisService)
      .useValue({ isHealthy: () => Promise.resolve(true) })
      .overrideProvider(TripsService)
      .useValue({
        budget,
        upsertBudget,
        deleteBudget: jest.fn(),
        createPlannedExpense,
        updatePlannedExpense: jest.fn(),
        deletePlannedExpense: jest.fn(),
      })
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
    httpServer = app.getHttpServer() as Server;
  });
  afterAll(async () => {
    await app?.close();
  });
  beforeEach(() => {
    allowAuth = true;
    jest.clearAllMocks();
  });
  it('accepts authenticated budget and expense commands with the JWT traveler', async () => {
    await request(httpServer)
      .put(`/api/v1/trips/${tripId}/budget`)
      .send({ amount: '1000.00', currency: 'ETB' })
      .expect(200);
    await request(httpServer)
      .post(`/api/v1/trips/${tripId}/budget/expenses`)
      .send({ category: 'FOOD', amount: '50.00' })
      .expect(201);
    expect(upsertBudget).toHaveBeenCalledWith(
      user.sub,
      tripId,
      expect.objectContaining({ currency: 'ETB' }),
    );
  });
  it('rejects invalid amounts, unknown fields, malformed UUIDs, and unauthenticated callers', async () => {
    await request(httpServer)
      .put(`/api/v1/trips/${tripId}/budget`)
      .send({ amount: '0', currency: 'ETB', userId: 'forbidden' })
      .expect(400);
    await request(httpServer)
      .post(`/api/v1/trips/${tripId}/budget/expenses`)
      .send({ category: 'FOOD', amount: '1.001' })
      .expect(400);
    await request(httpServer)
      .get('/api/v1/trips/not-a-uuid/budget')
      .expect(400);
    allowAuth = false;
    await request(httpServer).get(`/api/v1/trips/${tripId}/budget`).expect(401);
  });
});
