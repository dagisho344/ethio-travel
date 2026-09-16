import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  NotFoundException,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Server } from 'node:http';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AuthenticatedUser } from '../src/auth/authenticated-user';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { BookingsService } from '../src/bookings/bookings.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';

let allowAuth = true;
let currentRoles: string[] = ['TRAVELER'];
const user: AuthenticatedUser = {
  email: 'traveler@example.com',
  roles: currentRoles,
  sessionId: 'session',
  sub: '11111111-1111-4111-8111-111111111111',
};

const serviceId = '22222222-2222-4222-8222-222222222222';
const businessId = '33333333-3333-4333-8333-333333333333';
const bookingId = '44444444-4444-4444-8444-444444444444';
const ruleId = '55555555-5555-4555-8555-555555555555';
const overrideId = '66666666-6666-4666-8666-666666666666';
const futureStart = '2030-01-01T09:00:00.000Z';
const futureEnd = '2030-01-01T10:00:00.000Z';

const booking = {
  id: bookingId,
  reference: 'ETB-ABC123',
  bookingStatus: 'PENDING',
  paymentStatus: 'UNPAID',
};
const page = {
  data: [booking],
  meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
};

class TestJwtGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    if (!allowAuth) throw new UnauthorizedException();
    context.switchToHttp().getRequest<{ user: AuthenticatedUser }>().user = {
      ...user,
      roles: currentRoles,
    };
    return true;
  }
}

describe('Phase 7A booking routes', () => {
  let app: INestApplication | undefined;
  let httpServer: Server;
  const bookingsService = {
    availability: jest.fn(() =>
      Promise.resolve({
        serviceId,
        capacity: 4,
        reserved: 1,
        remaining: 3,
        available: true,
      }),
    ),
    cancelBusiness: jest.fn(() => Promise.resolve(booking)),
    cancelMine: jest.fn(() => Promise.resolve(booking)),
    completeBusiness: jest.fn(() => Promise.resolve(booking)),
    confirmBusiness: jest.fn(() => Promise.resolve(booking)),
    create: jest.fn(() => Promise.resolve(booking)),
    createOverride: jest.fn(() => Promise.resolve({ id: overrideId })),
    createRule: jest.fn(() => Promise.resolve({ id: ruleId })),
    deleteOverride: jest.fn(() => Promise.resolve()),
    deleteRule: jest.fn(() => Promise.resolve()),
    findAdmin: jest.fn(() => Promise.resolve(page)),
    findAdminById: jest.fn(() => Promise.resolve(booking)),
    findBusinessBooking: jest.fn(() => Promise.resolve(booking)),
    findBusinessBookings: jest.fn(() => Promise.resolve(page)),
    findMine: jest.fn(() => Promise.resolve(page)),
    findMineById: jest.fn(() => Promise.resolve(booking)),
    getConfig: jest.fn(() => Promise.resolve({ enabled: true })),
    noShowBusiness: jest.fn(() => Promise.resolve(booking)),
    overrides: jest.fn(() => Promise.resolve([{ id: overrideId }])),
    rejectBusiness: jest.fn(() => Promise.resolve(booking)),
    rules: jest.fn(() => Promise.resolve([{ id: ruleId }])),
    updateOverride: jest.fn(() => Promise.resolve({ id: overrideId })),
    updateRule: jest.fn(() => Promise.resolve({ id: ruleId })),
    upsertConfig: jest.fn(() => Promise.resolve({ enabled: true })),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({ isHealthy: () => Promise.resolve(true) })
      .overrideProvider(RedisService)
      .useValue({ isHealthy: () => Promise.resolve(true) })
      .overrideProvider(BookingsService)
      .useValue(bookingsService)
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
    currentRoles = ['TRAVELER'];
    jest.clearAllMocks();
  });

  it('serves public availability and validates query input', async () => {
    await request(httpServer)
      .get(
        `/api/v1/services/${serviceId}/availability?startAt=${futureStart}&endAt=${futureEnd}&quantity=1`,
      )
      .expect(200);
    await request(httpServer)
      .get(`/api/v1/services/${serviceId}/availability?startAt=bad`)
      .expect(400);
  });

  it('requires authentication for traveler booking routes', async () => {
    allowAuth = false;
    await request(httpServer).post('/api/v1/bookings').send({}).expect(401);
    await request(httpServer).get('/api/v1/users/me/bookings').expect(401);
    await request(httpServer)
      .post(`/api/v1/bookings/${bookingId}/cancel`)
      .send({ reason: 'Changed plans' })
      .expect(401);
  });

  it('creates and lists traveler bookings for the authenticated user', async () => {
    await request(httpServer)
      .post('/api/v1/bookings')
      .send({ serviceId, startAt: futureStart, endAt: futureEnd, quantity: 1 })
      .expect(201);
    expect(bookingsService.create).toHaveBeenCalledWith(
      user.sub,
      expect.objectContaining({ serviceId, quantity: 1 }),
    );

    await request(httpServer)
      .get('/api/v1/users/me/bookings?page=1&limit=20')
      .expect(200);
    expect(bookingsService.findMine).toHaveBeenCalledWith(
      user.sub,
      expect.objectContaining({ page: 1, limit: 20 }),
    );
  });

  it('routes business booking actions through object-membership service methods', async () => {
    currentRoles = ['BUSINESS_OWNER'];
    await request(httpServer)
      .get(`/api/v1/businesses/${businessId}/bookings`)
      .expect(200);
    await request(httpServer)
      .post(`/api/v1/businesses/${businessId}/bookings/${bookingId}/confirm`)
      .send({ note: 'Confirmed' })
      .expect(200);
    await request(httpServer)
      .post(`/api/v1/businesses/${businessId}/bookings/${bookingId}/reject`)
      .send({ reason: 'Unavailable' })
      .expect(200);
    await request(httpServer)
      .post(`/api/v1/businesses/${businessId}/bookings/${bookingId}/cancel`)
      .send({ reason: 'Closed' })
      .expect(200);
    await request(httpServer)
      .post(`/api/v1/businesses/${businessId}/bookings/${bookingId}/complete`)
      .send({ note: 'Completed' })
      .expect(200);
    await request(httpServer)
      .post(`/api/v1/businesses/${businessId}/bookings/${bookingId}/no-show`)
      .send({ reason: 'No arrival' })
      .expect(200);
  });

  it('manages availability settings through authenticated service routes', async () => {
    currentRoles = ['BUSINESS_OWNER'];
    await request(httpServer)
      .put(`/api/v1/services/${serviceId}/availability-config`)
      .send({ enabled: true, capacity: 4, minQuantity: 1, maxQuantity: 4 })
      .expect(200);
    await request(httpServer)
      .post(`/api/v1/services/${serviceId}/availability-rules`)
      .send({ weekday: 1, startTime: '09:00', endTime: '17:00', capacity: 4 })
      .expect(201);
    await request(httpServer)
      .patch(`/api/v1/services/${serviceId}/availability-rules/${ruleId}`)
      .send({ capacity: 5 })
      .expect(200);
    await request(httpServer)
      .post(`/api/v1/services/${serviceId}/availability-overrides`)
      .send({ startAt: futureStart, endAt: futureEnd, type: 'BLOCKED' })
      .expect(201);
    await request(httpServer)
      .get(`/api/v1/services/${serviceId}/availability-overrides`)
      .expect(200);
    await request(httpServer)
      .patch(
        `/api/v1/services/${serviceId}/availability-overrides/${overrideId}`,
      )
      .send({ reason: 'Holiday' })
      .expect(200);
    await request(httpServer)
      .delete(
        `/api/v1/services/${serviceId}/availability-overrides/${overrideId}`,
      )
      .expect(204);
    await request(httpServer)
      .delete(`/api/v1/services/${serviceId}/availability-rules/${ruleId}`)
      .expect(204);
  });

  it('requires ADMIN role for admin booking inspection', async () => {
    for (const roles of [
      ['TRAVELER'],
      ['BUSINESS_OWNER'],
      ['BUSINESS_STAFF'],
    ]) {
      currentRoles = roles;
      await request(httpServer).get('/api/v1/admin/bookings').expect(403);
      await request(httpServer)
        .get(`/api/v1/admin/bookings/${bookingId}`)
        .expect(403);
    }

    currentRoles = ['ADMIN'];
    await request(httpServer)
      .get(
        '/api/v1/admin/bookings?status=PENDING&reference=ETB&traveler=traveler&business=Demo&service=Stay&startFrom=2030-01-01T00:00:00.000Z&startTo=2030-01-02T00:00:00.000Z',
      )
      .expect(200);
    expect(bookingsService.findAdmin).toHaveBeenCalledWith(
      expect.objectContaining({
        business: 'Demo',
        reference: 'ETB',
        service: 'Stay',
        status: 'PENDING',
        traveler: 'traveler',
      }),
    );
    await request(httpServer)
      .get('/api/v1/admin/bookings/not-a-uuid')
      .expect(400);
    await request(httpServer)
      .get(`/api/v1/admin/bookings/${bookingId}`)
      .expect(200);
    expect(bookingsService.findAdminById).toHaveBeenCalledWith(bookingId);
  });

  it('returns the existing not-found response for a missing admin booking', async () => {
    const missingBookingId = '77777777-7777-4777-8777-777777777777';
    currentRoles = ['ADMIN'];
    bookingsService.findAdminById.mockRejectedValueOnce(
      new NotFoundException('Booking not found.'),
    );

    await request(httpServer)
      .get(`/api/v1/admin/bookings/${missingBookingId}`)
      .expect(404);
  });
});
