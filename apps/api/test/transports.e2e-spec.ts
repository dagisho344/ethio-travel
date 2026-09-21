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
import { TransportsService } from '../src/transports/transports.service';

const businessId = '22222222-2222-4222-8222-222222222222';
const serviceId = '33333333-3333-4333-8333-333333333333';
const routeId = '44444444-4444-4444-8444-444444444444';
const scheduleId = '55555555-5555-4555-8555-555555555555';
const originCityId = '66666666-6666-4666-8666-666666666666';
const destinationCityId = '77777777-7777-4777-8777-777777777777';
let allowAuth = true;
const user: AuthenticatedUser = {
  email: 'owner@example.com',
  roles: ['BUSINESS_OWNER'],
  sessionId: 'session',
  sub: '11111111-1111-4111-8111-111111111111',
};

class TestJwtGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    if (!allowAuth) throw new UnauthorizedException();
    context.switchToHttp().getRequest<{ user: AuthenticatedUser }>().user =
      user;
    return true;
  }
}

describe('Phase 14E transport routes', () => {
  let app: INestApplication | undefined;
  let httpServer: Server;
  const detail = { service: { id: serviceId }, detail: null, routes: [] };
  const findMine = jest.fn().mockResolvedValue(detail);
  const updateDetail = jest.fn().mockResolvedValue(detail);
  const listRoutes = jest.fn().mockResolvedValue([]);
  const createRoute = jest.fn().mockResolvedValue({ id: routeId });
  const updateRoute = jest.fn().mockResolvedValue({ id: routeId });
  const listSchedules = jest.fn().mockResolvedValue([]);
  const createSchedule = jest.fn().mockResolvedValue({ id: scheduleId });
  const updateSchedule = jest.fn().mockResolvedValue({ id: scheduleId });
  const setScheduleActive = jest.fn().mockResolvedValue({ id: scheduleId });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({ isHealthy: () => Promise.resolve(true) })
      .overrideProvider(RedisService)
      .useValue({ isHealthy: () => Promise.resolve(true) })
      .overrideProvider(TransportsService)
      .useValue({
        findMine,
        updateDetail,
        listRoutes,
        createRoute,
        updateRoute,
        listSchedules,
        createSchedule,
        updateSchedule,
        setScheduleActive,
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

  const basePath = `/api/v1/my/businesses/${businessId}/services/${serviceId}/transport`;

  it('serves authorized Transport detail, route, schedule, and explicit lifecycle routes', async () => {
    await request(httpServer).get(basePath).expect(200);
    await request(httpServer)
      .patch(basePath)
      .send({ mode: 'BUS', operatorName: 'Ethio Bus' })
      .expect(200);
    await request(httpServer).get(`${basePath}/routes`).expect(200);
    await request(httpServer)
      .post(`${basePath}/routes`)
      .send({ originCityId, destinationCityId })
      .expect(201);
    await request(httpServer)
      .patch(`${basePath}/routes/${routeId}`)
      .send({ originCityId })
      .expect(200);
    await request(httpServer)
      .get(`${basePath}/routes/${routeId}/schedules`)
      .expect(200);
    await request(httpServer)
      .post(`${basePath}/routes/${routeId}/schedules`)
      .send({
        departureAt: '2026-10-01T08:00:00.000Z',
        arrivalAt: '2026-10-01T12:00:00.000Z',
        fare: '250.00',
        currency: 'ETB',
        capacity: 24,
      })
      .expect(201);
    await request(httpServer)
      .patch(`${basePath}/routes/${routeId}/schedules/${scheduleId}`)
      .send({ capacity: 25 })
      .expect(200);
    await request(httpServer)
      .post(`${basePath}/routes/${routeId}/schedules/${scheduleId}/deactivate`)
      .expect(200);
    await request(httpServer)
      .post(`${basePath}/routes/${routeId}/schedules/${scheduleId}/activate`)
      .expect(200);
    expect(createSchedule).toHaveBeenCalledWith(
      user.sub,
      businessId,
      serviceId,
      routeId,
      expect.objectContaining({ currency: 'ETB', capacity: 24 }),
    );
    expect(setScheduleActive).toHaveBeenCalledWith(
      user.sub,
      businessId,
      serviceId,
      routeId,
      scheduleId,
      false,
    );
  });

  it('rejects invalid, timezone-free, unknown, and malformed Transport input', async () => {
    await request(httpServer)
      .patch(basePath)
      .send({ mode: '   ', unknown: true })
      .expect(400);
    await request(httpServer)
      .post(`${basePath}/routes`)
      .send({ originCityId: 'not-a-uuid', destinationCityId })
      .expect(400);
    await request(httpServer)
      .post(`${basePath}/routes/${routeId}/schedules`)
      .send({
        departureAt: '2026-10-01T08:00',
        arrivalAt: '2026-10-01T12:00:00.000Z',
        fare: '-1',
        currency: 'etb',
        capacity: 1.5,
      })
      .expect(400);
    await request(httpServer)
      .get('/api/v1/my/businesses/not-a-uuid/services/not-a-uuid/transport')
      .expect(400);
  });

  it('does not expose route or schedule delete endpoints or Transport booking and availability routes', async () => {
    await request(httpServer)
      .delete(`${basePath}/routes/${routeId}`)
      .expect(404);
    await request(httpServer)
      .delete(`${basePath}/routes/${routeId}/schedules/${scheduleId}`)
      .expect(404);
    await request(httpServer).post(`${basePath}/bookings`).expect(404);
    await request(httpServer).post(`${basePath}/availability`).expect(404);
  });

  it('requires authentication for Transport routes', async () => {
    allowAuth = false;
    await request(httpServer).get(basePath).expect(401);
  });
});
