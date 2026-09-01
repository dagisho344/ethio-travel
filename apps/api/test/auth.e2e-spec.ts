import {
  CanActivate,
  ExecutionContext,
  INestApplication,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Server } from 'node:http';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AuthenticatedUser } from '../src/auth/authenticated-user';
import { AuthService } from '../src/auth/auth.service';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import { UsersService } from '../src/users/users.service';

interface ApiBody {
  accessToken?: string;
  firstName?: string;
  refreshToken?: string;
  resetToken?: string;
  user?: {
    email?: string;
    passwordHash?: string;
  };
}

const safeUser = {
  email: 'traveler@example.com',
  firstName: 'Abebe',
  id: '11111111-1111-1111-1111-111111111111',
  lastName: 'Bekele',
  phone: null,
  roles: ['TRAVELER'],
};

const authenticatedUser: AuthenticatedUser = {
  email: safeUser.email,
  roles: safeUser.roles,
  sessionId: '22222222-2222-2222-2222-222222222222',
  sub: safeUser.id,
};

class TestJwtGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const httpRequest = context
      .switchToHttp()
      .getRequest<{ user: AuthenticatedUser }>();
    httpRequest.user = authenticatedUser;
    return true;
  }
}

describe('Auth and users endpoints', () => {
  let app: INestApplication | undefined;
  let httpServer: Server;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({ isHealthy: () => Promise.resolve(true) })
      .overrideProvider(RedisService)
      .useValue({ isHealthy: () => Promise.resolve(true) })
      .overrideProvider(AuthService)
      .useValue({
        login: () =>
          Promise.resolve({
            accessToken: 'access-token',
            refreshToken: 'refresh-token',
            user: safeUser,
          }),
        logout: () => Promise.resolve({ message: 'Logged out successfully.' }),
        refresh: () =>
          Promise.resolve({
            accessToken: 'new-access-token',
            refreshToken: 'new-refresh-token',
            user: safeUser,
          }),
        register: () =>
          Promise.resolve({
            accessToken: 'access-token',
            refreshToken: 'refresh-token',
            user: safeUser,
          }),
        requestPasswordReset: () =>
          Promise.resolve({
            message:
              'If the email exists, password reset instructions will be sent.',
          }),
        resetPassword: () =>
          Promise.resolve({ message: 'Password reset successfully.' }),
      })
      .overrideProvider(UsersService)
      .useValue({
        findSafeUserById: () => Promise.resolve(safeUser),
        updateMe: () => Promise.resolve({ ...safeUser, firstName: 'Updated' }),
      })
      .overrideGuard(JwtAuthGuard)
      .useClass(TestJwtGuard)
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
    httpServer = app.getHttpServer() as Server;
  });

  afterAll(async () => {
    await app?.close();
  });

  it('registers a user without exposing sensitive hashes', async () => {
    await request(httpServer)
      .post('/api/v1/auth/register')
      .send({ email: safeUser.email, password: 'StrongerPass123!' })
      .expect(201)
      .expect(({ body }: { body: ApiBody }) => {
        expect(body.accessToken).toBe('access-token');
        expect(body.user?.email).toBe(safeUser.email);
        expect(body.user?.passwordHash).toBeUndefined();
      });
  });

  it('logs in and refreshes tokens', async () => {
    await request(httpServer)
      .post('/api/v1/auth/login')
      .send({ email: safeUser.email, password: 'StrongerPass123!' })
      .expect(201);

    await request(httpServer)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: 'refresh-token-with-enough-length-for-validation' })
      .expect(201)
      .expect(({ body }: { body: ApiBody }) => {
        expect(body.refreshToken).toBe('new-refresh-token');
      });
  });

  it('logs out the current session', async () => {
    await request(httpServer).post('/api/v1/auth/logout').expect(201);
  });

  it('supports password reset request and reset endpoints', async () => {
    await request(httpServer)
      .post('/api/v1/auth/forgot-password')
      .send({ email: safeUser.email })
      .expect(201)
      .expect(({ body }: { body: ApiBody }) => {
        expect(body.resetToken).toBeUndefined();
      });

    await request(httpServer)
      .post('/api/v1/auth/reset-password')
      .send({
        password: 'AnotherStrongPass123!',
        token: 'reset-token-with-enough-length-for-validation',
      })
      .expect(201);
  });

  it('returns and updates the authenticated profile', async () => {
    await request(httpServer).get('/api/v1/users/me').expect(200);

    await request(httpServer)
      .patch('/api/v1/users/me')
      .send({ firstName: 'Updated' })
      .expect(200)
      .expect(({ body }: { body: ApiBody }) => {
        expect(body.firstName).toBe('Updated');
      });
  });
});
