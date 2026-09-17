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
import { ToursService } from '../src/tours/tours.service';

const businessId = '22222222-2222-4222-8222-222222222222';
const serviceId = '33333333-3333-4333-8333-333333333333';
const itemId = '44444444-4444-4444-8444-444444444444';
let allowAuth = true;
const user: AuthenticatedUser = {
  email: 'owner@example.com',
  roles: ['BUSINESS_OWNER'],
  sessionId: 'session',
  sub: '11111111-1111-4111-8111-111111111111',
};
const tour = {
  service: {
    id: serviceId,
    name: 'Wolaita Highlands Tour',
    status: 'DRAFT',
    category: { code: 'TOUR', family: 'TOUR', name: 'Tour' },
  },
  detail: {
    id: '55555555-5555-4555-8555-555555555555',
    durationDays: 3,
    difficulty: 'Moderate',
    meetingPoint: 'Sodo bus station',
    inclusions: ['Guide'],
    exclusions: [],
  },
  itinerary: [],
};

class TestJwtGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    if (!allowAuth) throw new UnauthorizedException();
    context.switchToHttp().getRequest<{ user: AuthenticatedUser }>().user =
      user;
    return true;
  }
}

describe('Phase 14D tour routes', () => {
  let app: INestApplication | undefined;
  let httpServer: Server;
  const findMine = jest.fn().mockResolvedValue(tour);
  const updateDetail = jest.fn().mockResolvedValue(tour);
  const listItinerary = jest.fn().mockResolvedValue([]);
  const createItineraryItem = jest.fn().mockResolvedValue({ id: itemId });
  const updateItineraryItem = jest.fn().mockResolvedValue({ id: itemId });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({ isHealthy: () => Promise.resolve(true) })
      .overrideProvider(RedisService)
      .useValue({ isHealthy: () => Promise.resolve(true) })
      .overrideProvider(ToursService)
      .useValue({
        findMine,
        updateDetail,
        listItinerary,
        createItineraryItem,
        updateItineraryItem,
      })
      .overrideGuard(JwtAuthGuard)
      .useClass(TestJwtGuard)
      .compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        forbidNonWhitelisted: true,
        transform: true,
        whitelist: true,
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

  const basePath = `/api/v1/my/businesses/${businessId}/services/${serviceId}/tour`;

  it('serves authorized Tour detail and itinerary routes', async () => {
    await request(httpServer).get(basePath).expect(200);
    await request(httpServer)
      .patch(basePath)
      .send({
        durationDays: 3,
        difficulty: 'Moderate',
        meetingPoint: 'Sodo bus station',
        inclusions: ['Guide'],
        exclusions: ['Lunch'],
      })
      .expect(200);
    await request(httpServer).get(`${basePath}/itinerary`).expect(200);
    await request(httpServer)
      .post(`${basePath}/itinerary`)
      .send({ dayNumber: 1, title: 'Arrival', sortOrder: 0 })
      .expect(201);
    await request(httpServer)
      .patch(`${basePath}/itinerary/${itemId}`)
      .send({ title: 'Updated arrival' })
      .expect(200);

    expect(updateDetail).toHaveBeenCalledWith(
      user.sub,
      businessId,
      serviceId,
      expect.objectContaining({ inclusions: ['Guide'] }),
    );
    expect(createItineraryItem).toHaveBeenCalledWith(
      user.sub,
      businessId,
      serviceId,
      expect.objectContaining({ dayNumber: 1 }),
    );
  });

  it('rejects invalid Tour detail, itinerary input, unknown fields, and malformed identifiers', async () => {
    await request(httpServer)
      .patch(basePath)
      .send({ durationDays: 0, inclusions: ['   '], unknown: true })
      .expect(400);
    await request(httpServer)
      .patch(basePath)
      .send({ durationDays: 1.5 })
      .expect(400);
    await request(httpServer)
      .post(`${basePath}/itinerary`)
      .send({ dayNumber: 0, title: '   ', sortOrder: -1 })
      .expect(400);
    await request(httpServer)
      .post(`${basePath}/itinerary`)
      .send({ dayNumber: 1.5, title: 'Arrival', sortOrder: 1.5 })
      .expect(400);
    await request(httpServer)
      .get('/api/v1/my/businesses/not-a-uuid/services/not-a-uuid/tour')
      .expect(400);
  });

  it('does not expose itinerary delete, Tour booking, or Tour availability routes', async () => {
    await request(httpServer)
      .delete(`${basePath}/itinerary/${itemId}`)
      .expect(404);
    await request(httpServer).post(`${basePath}/bookings`).expect(404);
    await request(httpServer).post(`${basePath}/availability`).expect(404);
  });

  it('requires authentication for Tour routes', async () => {
    allowAuth = false;
    await request(httpServer).get(basePath).expect(401);
  });
});
