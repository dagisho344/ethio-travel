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
import { PaymentsService } from '../src/payments/payments.service';
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

const bookingId = '22222222-2222-4222-8222-222222222222';
const paymentId = '33333333-3333-4333-8333-333333333333';
const businessId = '44444444-4444-4444-8444-444444444444';
const payment = {
  id: paymentId,
  bookingId,
  status: 'PENDING',
  amount: '120.00',
  currency: 'ETB',
};
const page = {
  data: [payment],
  meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
};

type AdminRefundContext = {
  actor: AuthenticatedUser;
  context: {
    correlationId?: string;
    ipAddress?: string;
    userAgent?: string | string[] | undefined;
  };
};
type RefundDto = { amount: number; idempotencyKey?: string; reason?: string };
type RefundResult = typeof payment & { status: string };

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

describe('Phase 8A payment routes', () => {
  let app: INestApplication | undefined;
  let httpServer: Server;
  const refund = jest
    .fn<
      Promise<RefundResult>,
      [string, RefundDto, string | undefined, AdminRefundContext]
    >()
    .mockResolvedValue({ ...payment, status: 'REFUNDED' });
  const paymentsService = {
    createForBooking: jest.fn(() => Promise.resolve(payment)),
    findForBooking: jest.fn(() => Promise.resolve(page)),
    findMineById: jest.fn(() => Promise.resolve(payment)),
    findBusiness: jest.fn(() => Promise.resolve(page)),
    findBusinessById: jest.fn(() => Promise.resolve(payment)),
    findAdmin: jest.fn(() => Promise.resolve(page)),
    findAdminById: jest.fn(() => Promise.resolve(payment)),
    processWebhook: jest.fn(() => Promise.resolve({ received: true })),
    refund,
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({ isHealthy: () => Promise.resolve(true) })
      .overrideProvider(RedisService)
      .useValue({ isHealthy: () => Promise.resolve(true) })
      .overrideProvider(PaymentsService)
      .useValue(paymentsService)
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

  it('requires auth for traveler payment operations', async () => {
    allowAuth = false;
    await request(httpServer)
      .post(`/api/v1/bookings/${bookingId}/payments`)
      .send({})
      .expect(401);
    await request(httpServer)
      .get(`/api/v1/bookings/${bookingId}/payments`)
      .expect(401);
    await request(httpServer).get(`/api/v1/payments/${paymentId}`).expect(401);
  });

  it('routes traveler payment initiation without accepting spoofed amount', async () => {
    await request(httpServer)
      .post(`/api/v1/bookings/${bookingId}/payments`)
      .set('Idempotency-Key', 'traveler-pay-001')
      .send({ idempotencyKey: 'body-key-001' })
      .expect(201);
    expect(paymentsService.createForBooking).toHaveBeenCalledWith(
      user.sub,
      bookingId,
      expect.objectContaining({ idempotencyKey: 'body-key-001' }),
      'traveler-pay-001',
    );

    await request(httpServer)
      .post(`/api/v1/bookings/${bookingId}/payments`)
      .send({ amount: 1, currency: 'USD' })
      .expect(400);
  });

  it('routes traveler, business, webhook and admin payment queries/actions', async () => {
    await request(httpServer)
      .get(`/api/v1/bookings/${bookingId}/payments?page=1&limit=20`)
      .expect(200);
    await request(httpServer).get(`/api/v1/payments/${paymentId}`).expect(200);

    currentRoles = ['BUSINESS_OWNER'];
    await request(httpServer)
      .get(`/api/v1/businesses/${businessId}/payments`)
      .expect(200);
    await request(httpServer)
      .get(`/api/v1/businesses/${businessId}/payments/${paymentId}`)
      .expect(200);

    await request(httpServer)
      .post('/api/v1/payments/webhooks/DEVELOPMENT')
      .set('x-ethiotravel-signature', 'sha256=test')
      .send({ eventId: 'evt_1' })
      .expect(200);

    currentRoles = ['ADMIN'];
    await request(httpServer)
      .get(
        '/api/v1/admin/payments?reference=ETB&traveler=traveler&business=Demo&currency=ETB&from=2030-01-01T00:00:00.000Z&to=2030-01-02T00:00:00.000Z',
      )
      .expect(200);
    expect(paymentsService.findAdmin).toHaveBeenCalledWith(
      expect.objectContaining({
        business: 'Demo',
        currency: 'ETB',
        reference: 'ETB',
        traveler: 'traveler',
      }),
    );
    await request(httpServer)
      .get(`/api/v1/admin/payments/${paymentId}`)
      .expect(200);
    await request(httpServer)
      .post(`/api/v1/admin/payments/${paymentId}/refund`)
      .send({ amount: 10, reason: 'Duplicate charge' })
      .expect(200);
    const refundCall = refund.mock.calls[0];
    expect(refundCall).toBeDefined();
    if (!refundCall) throw new Error('Expected administrator refund call.');
    const [calledPaymentId, dto, idempotencyKey, audit] = refundCall;
    expect(calledPaymentId).toBe(paymentId);
    expect(dto).toEqual({ amount: 10, reason: 'Duplicate charge' });
    expect(idempotencyKey).toBeUndefined();
    expect(audit.actor.sub).toBe(user.sub);
    expect(audit.context).toEqual(expect.objectContaining({}));
  });

  it('requires ADMIN role for admin payment inspection and refunds', async () => {
    for (const roles of [
      ['TRAVELER'],
      ['BUSINESS_OWNER'],
      ['BUSINESS_STAFF'],
    ]) {
      currentRoles = roles;
      await request(httpServer).get('/api/v1/admin/payments').expect(403);
      await request(httpServer)
        .get(`/api/v1/admin/payments/${paymentId}`)
        .expect(403);
      await request(httpServer)
        .post(`/api/v1/admin/payments/${paymentId}/refund`)
        .send({ amount: 10 })
        .expect(403);
    }

    currentRoles = ['ADMIN'];
    await request(httpServer)
      .get('/api/v1/admin/payments/not-a-uuid')
      .expect(400);
  });

  it('returns the existing not-found response for a missing admin payment', async () => {
    const missingPaymentId = '55555555-5555-4555-8555-555555555555';
    currentRoles = ['ADMIN'];
    paymentsService.findAdminById.mockRejectedValueOnce(
      new NotFoundException('Payment not found.'),
    );

    await request(httpServer)
      .get(`/api/v1/admin/payments/${missingPaymentId}`)
      .expect(404);
  });
});
