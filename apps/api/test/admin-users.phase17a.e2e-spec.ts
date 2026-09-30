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
import { AdminService } from '../src/admin/admin.service';
import { AppModule } from '../src/app.module';
import { AuthenticatedUser } from '../src/auth/authenticated-user';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';

const userId = '22222222-2222-4222-8222-222222222222';
let authenticated = true;
let roles: string[] = ['ADMIN'];
const actor: AuthenticatedUser = {
  email: 'admin@example.com',
  roles,
  sessionId: 'session',
  sub: '11111111-1111-4111-8111-111111111111',
};

class TestJwtGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    if (!authenticated) throw new UnauthorizedException();
    context.switchToHttp().getRequest<{ user: AuthenticatedUser }>().user = {
      ...actor,
      roles,
    };
    return true;
  }
}

describe('Phase 17A-1 administrator user API', () => {
  let app: INestApplication | undefined;
  let server: Server;
  const service = {
    createUser: jest
      .fn()
      .mockResolvedValue({ id: userId, email: 'new@example.com' }),
    updateUser: jest.fn().mockResolvedValue({ id: userId }),
    deactivateUser: jest
      .fn()
      .mockResolvedValue({ id: userId, status: 'DEACTIVATED' }),
    reactivateUser: jest
      .fn()
      .mockResolvedValue({ id: userId, status: 'ACTIVE' }),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({ isHealthy: () => Promise.resolve(true) })
      .overrideProvider(RedisService)
      .useValue({ isHealthy: () => Promise.resolve(true) })
      .overrideProvider(AdminService)
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

  const createBody = {
    firstName: 'New',
    lastName: 'Traveler',
    email: '  NEW@example.com  ',
    roles: ['TRAVELER'],
    temporaryPassword: 'secure-password-123',
  };

  it('requires an authenticated administrator for every new mutation', async () => {
    roles = ['TRAVELER'];
    await request(server)
      .post('/api/v1/admin/users')
      .send(createBody)
      .expect(403);
    await request(server)
      .patch(`/api/v1/admin/users/${userId}`)
      .send({ firstName: 'A' })
      .expect(403);
    await request(server)
      .post(`/api/v1/admin/users/${userId}/deactivate`)
      .send({ reason: 'Requested' })
      .expect(403);
    await request(server)
      .post(`/api/v1/admin/users/${userId}/reactivate`)
      .send({ reason: 'Requested' })
      .expect(403);
    authenticated = false;
    await request(server)
      .post('/api/v1/admin/users')
      .send(createBody)
      .expect(401);
    expect(service.createUser).not.toHaveBeenCalled();
  });

  it('normalizes input and rejects mass assignment, invalid roles and weak passwords', async () => {
    await request(server)
      .post('/api/v1/admin/users')
      .send(createBody)
      .expect(201);
    expect(service.createUser).toHaveBeenCalledWith(
      expect.objectContaining({ sub: actor.sub }),
      expect.objectContaining({ email: 'new@example.com' }),
      expect.objectContaining({}),
    );
    await request(server)
      .post('/api/v1/admin/users')
      .send({ ...createBody, passwordHash: 'injected' })
      .expect(400);
    await request(server)
      .post('/api/v1/admin/users')
      .send({ ...createBody, roles: ['ROOT'] })
      .expect(400);
    await request(server)
      .post('/api/v1/admin/users')
      .send({ ...createBody, temporaryPassword: 'short' })
      .expect(400);
    await request(server)
      .patch(`/api/v1/admin/users/${userId}`)
      .send({ status: 'ACTIVE' })
      .expect(400);
    await request(server)
      .patch(`/api/v1/admin/users/${userId}`)
      .send({ roles: ['ADMIN', 'ADMIN'] })
      .expect(400);
    await request(server)
      .patch('/api/v1/admin/users/not-a-uuid')
      .send({ firstName: 'A' })
      .expect(400);
  });

  it('keeps lifecycle actions separate and requires valid reason bodies', async () => {
    await request(server)
      .patch(`/api/v1/admin/users/${userId}`)
      .send({ firstName: 'Updated' })
      .expect(200);
    await request(server)
      .post(`/api/v1/admin/users/${userId}/deactivate`)
      .send({ reason: 'Administrative review' })
      .expect(200);
    await request(server)
      .post(`/api/v1/admin/users/${userId}/reactivate`)
      .send({ reason: 'Review resolved' })
      .expect(200);
    expect(service.deactivateUser).toHaveBeenCalledWith(
      expect.objectContaining({ sub: actor.sub }),
      userId,
      { reason: 'Administrative review' },
      expect.objectContaining({}),
    );
    await request(server)
      .post(`/api/v1/admin/users/${userId}/deactivate`)
      .send({ reason: '  ' })
      .expect(400);
    await request(server)
      .post(`/api/v1/admin/users/${userId}/reactivate`)
      .send({ reason: 'Valid reason', status: 'ACTIVE' })
      .expect(400);
  });
});
