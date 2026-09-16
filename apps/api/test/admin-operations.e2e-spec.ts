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
import { AdminService } from '../src/admin/admin.service';
import { AuthenticatedUser } from '../src/auth/authenticated-user';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';

let allowAuth = true;
let currentRoles: string[] = ['TRAVELER'];
const user: AuthenticatedUser = {
  email: 'admin@example.com',
  roles: currentRoles,
  sessionId: 'session',
  sub: '11111111-1111-4111-8111-111111111111',
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

describe('Phase 13C administrator analytics and settings routes', () => {
  let app: INestApplication | undefined;
  let httpServer: Server;
  const adminService = {
    analytics: jest.fn(() => Promise.resolve({ users: { total: 1 } })),
    settings: jest.fn(() =>
      Promise.resolve({
        supportEmail: null,
        supportMessage: null,
        supportPhone: null,
        updatedAt: null,
      }),
    ),
    updateSettings: jest.fn(() =>
      Promise.resolve({
        supportEmail: 'support@ethiotravel.example',
        supportMessage: null,
        supportPhone: null,
        updatedAt: '2030-01-01T00:00:00.000Z',
      }),
    ),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({ isHealthy: () => Promise.resolve(true) })
      .overrideProvider(RedisService)
      .useValue({ isHealthy: () => Promise.resolve(true) })
      .overrideProvider(AdminService)
      .useValue(adminService)
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

  it('denies analytics and settings to every non-admin role', async () => {
    for (const roles of [
      ['TRAVELER'],
      ['BUSINESS_OWNER'],
      ['BUSINESS_STAFF'],
    ]) {
      currentRoles = roles;
      await request(httpServer).get('/api/v1/admin/analytics').expect(403);
      await request(httpServer).get('/api/v1/admin/settings').expect(403);
    }
  });

  it('serves bounded analytics and typed non-secret settings to an administrator', async () => {
    currentRoles = ['ADMIN'];
    await request(httpServer).get('/api/v1/admin/analytics').expect(200);
    await request(httpServer).get('/api/v1/admin/settings').expect(200);
    await request(httpServer)
      .patch('/api/v1/admin/settings')
      .send({ supportEmail: 'support@ethiotravel.example' })
      .expect(200);
    expect(adminService.analytics).toHaveBeenCalledTimes(1);
    expect(adminService.settings).toHaveBeenCalledTimes(1);
    expect(adminService.updateSettings).toHaveBeenCalledWith(
      expect.objectContaining({ sub: user.sub }),
      { supportEmail: 'support@ethiotravel.example' },
      expect.objectContaining({}),
    );
  });

  it('rejects unknown settings fields before the service is invoked', async () => {
    currentRoles = ['ADMIN'];
    await request(httpServer)
      .patch('/api/v1/admin/settings')
      .send({ DATABASE_URL: 'postgresql://must-not-be-a-setting' })
      .expect(400);
    expect(adminService.updateSettings).not.toHaveBeenCalled();
  });
});
