/* eslint-disable @typescript-eslint/no-unsafe-member-access */
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
import { FavoriteTargetType } from '../src/favorites/dto/favorite-target-type.enum';
import { FavoritesService } from '../src/favorites/favorites.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';

let allowAuth = true;
const user: AuthenticatedUser = {
  email: 'traveler@example.com',
  roles: ['TRAVELER'],
  sessionId: 'session',
  sub: '11111111-1111-4111-8111-111111111111',
};

const favorite = {
  id: '22222222-2222-4222-8222-222222222222',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  target: {
    type: FavoriteTargetType.BUSINESS,
    id: '33333333-3333-4333-8333-333333333333',
    name: 'Public Business',
    slug: 'public-business',
    description: 'Visible business description',
    category: { code: 'HOTEL', name: 'Hotel' },
    city: { name: 'Bole', slug: 'bole' },
    region: { name: 'Addis Ababa', slug: 'addis-ababa' },
    destination: null,
  },
};

class TestJwtGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    if (!allowAuth) throw new UnauthorizedException();
    context.switchToHttp().getRequest<{ user: AuthenticatedUser }>().user =
      user;
    return true;
  }
}

describe('Phase 6B favorite routes', () => {
  let app: INestApplication | undefined;
  let httpServer: Server;
  const favoritesService = {
    create: jest.fn(() => Promise.resolve(favorite)),
    findMine: jest.fn(() =>
      Promise.resolve({
        data: [favorite],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      }),
    ),
    remove: jest.fn(() => Promise.resolve()),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({ isHealthy: () => Promise.resolve(true) })
      .overrideProvider(RedisService)
      .useValue({ isHealthy: () => Promise.resolve(true) })
      .overrideProvider(FavoritesService)
      .useValue(favoritesService)
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

  it('requires authentication for favorites routes', async () => {
    allowAuth = false;
    await request(httpServer).post('/api/v1/favorites').send({}).expect(401);
    await request(httpServer).get('/api/v1/users/me/favorites').expect(401);
    await request(httpServer)
      .delete('/api/v1/favorites/22222222-2222-4222-8222-222222222222')
      .expect(401);
  });

  it('creates a favorite for the authenticated user', async () => {
    await request(httpServer)
      .post('/api/v1/favorites')
      .send({
        targetType: FavoriteTargetType.BUSINESS,
        targetId: '33333333-3333-4333-8333-333333333333',
      })
      .expect(201);

    expect(favoritesService.create).toHaveBeenCalledWith(user.sub, {
      targetType: FavoriteTargetType.BUSINESS,
      targetId: '33333333-3333-4333-8333-333333333333',
    });
  });

  it('validates target type and target id input', async () => {
    await request(httpServer)
      .post('/api/v1/favorites')
      .send({ targetType: 'BOOKING', targetId: 'not-a-uuid' })
      .expect(400);
  });

  it('lists own favorites with target type pagination query', async () => {
    await request(httpServer)
      .get('/api/v1/users/me/favorites?targetType=BUSINESS&page=1&limit=20')
      .expect(200)
      .expect(({ body }) => {
        expect(body.data[0].target.type).toBe(FavoriteTargetType.BUSINESS);
        expect(body.data[0].target.adminNotes).toBeUndefined();
        expect(body.data[0].target.members).toBeUndefined();
      });

    expect(favoritesService.findMine).toHaveBeenCalledWith(
      user.sub,
      expect.objectContaining({
        targetType: FavoriteTargetType.BUSINESS,
        page: 1,
        limit: 20,
      }),
    );
  });

  it('deletes an owned favorite by id', async () => {
    await request(httpServer)
      .delete('/api/v1/favorites/22222222-2222-4222-8222-222222222222')
      .expect(204);

    expect(favoritesService.remove).toHaveBeenCalledWith(
      user.sub,
      '22222222-2222-4222-8222-222222222222',
    );
  });
});
