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
import { DestinationBookingConfigService } from '../src/destination-booking-config/destination-booking-config.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';

const destinationId = '33333333-3333-4333-8333-333333333333';
const accountId = '44444444-4444-4444-8444-444444444444';
let authenticated = true;
let roles: string[] = ['ADMIN'];

class TestJwtGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    if (!authenticated) throw new UnauthorizedException();
    context.switchToHttp().getRequest<{ user: AuthenticatedUser }>().user = {
      sub: '11111111-1111-4111-8111-111111111111',
      sessionId: 'test-session',
      email: 'test-admin@example.invalid',
      roles,
    };
    return true;
  }
}

describe('Phase 17C-1 Admin destination configuration HTTP', () => {
  let app: INestApplication | undefined;
  let server: Server;
  const service = {
    getConfig: jest.fn().mockResolvedValue({ bookingEnabled: false }),
    updateConfig: jest.fn().mockResolvedValue({ bookingEnabled: false }),
    listAccounts: jest.fn().mockResolvedValue({ data: [], meta: { total: 0 } }),
    createAccount: jest.fn().mockResolvedValue({ id: accountId }),
    updateAccount: jest.fn().mockResolvedValue({ id: accountId }),
    deactivateAccount: jest
      .fn()
      .mockResolvedValue({ id: accountId, isActive: false }),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({ isHealthy: () => Promise.resolve(true) })
      .overrideProvider(RedisService)
      .useValue({ isHealthy: () => Promise.resolve(true) })
      .overrideProvider(DestinationBookingConfigService)
      .useValue(service)
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
    server = app.getHttpServer() as Server;
  });

  afterAll(async () => app?.close());

  beforeEach(() => {
    authenticated = true;
    roles = ['ADMIN'];
    jest.clearAllMocks();
  });

  it('protects all configuration and account routes from anonymous and non-Admin callers', async () => {
    const paths = [
      ['get', `/api/v1/admin/destinations/${destinationId}/booking-config`],
      ['put', `/api/v1/admin/destinations/${destinationId}/booking-config`],
      ['get', `/api/v1/admin/destinations/${destinationId}/payment-accounts`],
      ['post', `/api/v1/admin/destinations/${destinationId}/payment-accounts`],
      [
        'patch',
        `/api/v1/admin/destinations/${destinationId}/payment-accounts/${accountId}`,
      ],
      [
        'post',
        `/api/v1/admin/destinations/${destinationId}/payment-accounts/${accountId}/deactivate`,
      ],
    ] as const;
    for (const [method, path] of paths) {
      roles = ['TRAVELER'];
      await request(server)[method](path).send({}).expect(403);
      authenticated = false;
      await request(server)[method](path).send({}).expect(401);
      authenticated = true;
    }
    expect(service.getConfig).not.toHaveBeenCalled();
    expect(service.createAccount).not.toHaveBeenCalled();
  });

  it('rejects bad UUIDs, unknown fields, imprecise money, and invalid providers', async () => {
    await request(server)
      .put('/api/v1/admin/destinations/not-uuid/booking-config')
      .send({ priceAmount: '125.00' })
      .expect(400);
    await request(server)
      .patch(
        `/api/v1/admin/destinations/${destinationId}/payment-accounts/not-uuid`,
      )
      .send({ displayOrder: 1 })
      .expect(400);
    await request(server)
      .put(`/api/v1/admin/destinations/${destinationId}/booking-config`)
      .send({ priceAmount: 125.25 })
      .expect(400);
    await request(server)
      .put(`/api/v1/admin/destinations/${destinationId}/booking-config`)
      .send({ priceAmount: '125.001' })
      .expect(400);
    await request(server)
      .put(`/api/v1/admin/destinations/${destinationId}/booking-config`)
      .send({ currency: 'USD' })
      .expect(400);
    await request(server)
      .put(`/api/v1/admin/destinations/${destinationId}/booking-config`)
      .send({ status: 'PUBLISHED' })
      .expect(400);
    await request(server)
      .put(`/api/v1/admin/destinations/${destinationId}/booking-config`)
      .send({
        bookingEnabled: true,
        priceAmount: '125.00',
        requestDescription: 'Visit',
      })
      .expect(400);
    await request(server)
      .put(`/api/v1/admin/destinations/${destinationId}/booking-config`)
      .send({
        bookingEnabled: false,
        priceAmount: '125.00',
        requestDescription: 'x'.repeat(1001),
        bookingInstructions: null,
      })
      .expect(400);
    await request(server)
      .post(`/api/v1/admin/destinations/${destinationId}/payment-accounts`)
      .send({
        provider: 'STRIPE',
        accountHolderName: 'Test',
        accountIdentifier: '12345678',
      })
      .expect(400);
    await request(server)
      .post(`/api/v1/admin/destinations/${destinationId}/payment-accounts`)
      .send({
        provider: 'CBE',
        accountHolderName: 'Test',
        accountIdentifier: '12345678',
        normalizedIdentifier: 'injected',
      })
      .expect(400);
    await request(server)
      .post(
        `/api/v1/admin/destinations/${destinationId}/payment-accounts/${accountId}/deactivate`,
      )
      .send({ isActive: false })
      .expect(400);
  });

  it('forwards only validated Admin commands', async () => {
    await request(server)
      .get(`/api/v1/admin/destinations/${destinationId}/booking-config`)
      .expect(200);
    await request(server)
      .put(`/api/v1/admin/destinations/${destinationId}/booking-config`)
      .send({
        bookingEnabled: false,
        priceAmount: '125.00',
        currency: 'ETB',
        priceUnit: 'PER_BOOKING',
        requestDescription:
          'Request a guided visit; admission is not guaranteed.',
        bookingInstructions: null,
      })
      .expect(200);
    await request(server)
      .get(`/api/v1/admin/destinations/${destinationId}/payment-accounts`)
      .expect('Cache-Control', 'no-store')
      .expect(200);
    await request(server)
      .post(`/api/v1/admin/destinations/${destinationId}/payment-accounts`)
      .send({
        provider: 'TELEBIRR',
        accountHolderName: 'Test Holder',
        accountIdentifier: '+251 912 345 678',
      })
      .expect(201);
    await request(server)
      .patch(
        `/api/v1/admin/destinations/${destinationId}/payment-accounts/${accountId}`,
      )
      .send({ displayOrder: 2 })
      .expect(200);
    await request(server)
      .post(
        `/api/v1/admin/destinations/${destinationId}/payment-accounts/${accountId}/deactivate`,
      )
      .send({})
      .expect(200);
    expect(service.updateConfig).toHaveBeenCalled();
    expect(service.createAccount).toHaveBeenCalled();
    expect(service.deactivateAccount).toHaveBeenCalled();
  });
});
