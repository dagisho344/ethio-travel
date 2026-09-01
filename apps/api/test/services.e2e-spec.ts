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
import { ServiceCategoriesService } from '../src/service-categories/service-categories.service';
import { ServicesService } from '../src/services/services.service';

let allowAuth = true;
let currentRoles: string[] = ['ADMIN'];
const user: AuthenticatedUser = {
  email: 'admin@example.com',
  roles: currentRoles,
  sessionId: 's',
  sub: '11111111-1111-4111-8111-111111111111',
};
const serviceRecord = {
  id: '44444444-4444-4444-8444-444444444444',
  slug: 'standard-room',
  name: 'Standard Room',
};
const page = {
  data: [serviceRecord],
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

describe('Phase 4 service routes', () => {
  let app: INestApplication | undefined;
  let httpServer: Server;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({ isHealthy: () => Promise.resolve(true) })
      .overrideProvider(RedisService)
      .useValue({ isHealthy: () => Promise.resolve(true) })
      .overrideProvider(ServiceCategoriesService)
      .useValue({
        create: () => Promise.resolve({ code: 'ROOM' }),
        findAdmin: () => Promise.resolve(page),
        findPublic: () => Promise.resolve(page),
        update: () => Promise.resolve({ code: 'ROOM' }),
      })
      .overrideProvider(ServicesService)
      .useValue({
        archiveAdmin: () => Promise.resolve(serviceRecord),
        archiveMine: () => Promise.resolve(serviceRecord),
        create: () => Promise.resolve(serviceRecord),
        findAdmin: () => Promise.resolve(page),
        findAdminById: () => Promise.resolve(serviceRecord),
        findMine: () => Promise.resolve(page),
        findMineById: () => Promise.resolve(serviceRecord),
        findPublic: () => Promise.resolve(page),
        findPublicByBusinessSlugs: () => Promise.resolve(page),
        findPublicBySlugs: () => Promise.resolve(serviceRecord),
        publishMine: () => Promise.resolve(serviceRecord),
        unpublishAdmin: () => Promise.resolve(serviceRecord),
        unpublishMine: () => Promise.resolve(serviceRecord),
        updateMine: () => Promise.resolve(serviceRecord),
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
    currentRoles = ['ADMIN'];
  });

  it('serves implemented public and owner service routes', async () => {
    await request(httpServer).get('/api/v1/service-categories').expect(200);
    await request(httpServer).get('/api/v1/services').expect(200);
    await request(httpServer)
      .get('/api/v1/regions/south/cities/sodo/businesses/hotel/services')
      .expect(200);
    await request(httpServer)
      .get(
        '/api/v1/regions/south/cities/sodo/businesses/hotel/services/standard-room',
      )
      .expect(200);
    await request(httpServer)
      .post('/api/v1/my/businesses/b/services')
      .send({
        categoryId: 'c',
        name: 'Room',
        shortDescription: 'Short',
        description: 'Long',
        pricingModel: 'FREE',
      })
      .expect(201);
    await request(httpServer)
      .get('/api/v1/my/businesses/b/services')
      .expect(200);
    await request(httpServer)
      .get('/api/v1/my/businesses/b/services/s')
      .expect(200);
    await request(httpServer)
      .patch('/api/v1/my/businesses/b/services/s')
      .send({ name: 'Room 2' })
      .expect(200);
    await request(httpServer)
      .post('/api/v1/my/businesses/b/services/s/publish')
      .expect(200);
    await request(httpServer)
      .post('/api/v1/my/businesses/b/services/s/unpublish')
      .expect(200);
    await request(httpServer)
      .post('/api/v1/my/businesses/b/services/s/archive')
      .expect(200);
  });

  it('serves implemented admin service routes to admins only', async () => {
    await request(httpServer)
      .get('/api/v1/admin/service-categories')
      .expect(200);
    await request(httpServer)
      .post('/api/v1/admin/service-categories')
      .send({ code: 'ROOM', name: 'Room' })
      .expect(201);
    await request(httpServer)
      .patch('/api/v1/admin/service-categories/c')
      .send({ name: 'Room' })
      .expect(200);
    await request(httpServer).get('/api/v1/admin/services').expect(200);
    await request(httpServer).get('/api/v1/admin/services/s').expect(200);
    await request(httpServer)
      .post('/api/v1/admin/services/s/unpublish')
      .expect(200);
    await request(httpServer)
      .post('/api/v1/admin/services/s/archive')
      .expect(200);
    currentRoles = ['TRAVELER'];
    await request(httpServer).get('/api/v1/admin/services').expect(403);
  });

  it('does not expose media upload, finalize, attachment, or delete routes', async () => {
    await request(httpServer)
      .post('/api/v1/media/upload-intents')
      .send({ storageKey: 'client-controlled' })
      .expect(404);
    await request(httpServer)
      .post('/api/v1/media/m/finalize')
      .send({ storageKey: 'client-controlled' })
      .expect(404);
    await request(httpServer)
      .post('/api/v1/my/businesses/b/media')
      .send({ storageKey: 'client-controlled' })
      .expect(404);
    await request(httpServer)
      .post('/api/v1/my/businesses/b/services/s/media')
      .send({ storageKey: 'client-controlled' })
      .expect(404);
    await request(httpServer)
      .delete('/api/v1/my/businesses/b/services/s')
      .expect(404);
    await request(httpServer).delete('/api/v1/admin/services/s').expect(404);
  });

  it('requires authentication for owner service routes', async () => {
    allowAuth = false;
    await request(httpServer)
      .get('/api/v1/my/businesses/b/services')
      .expect(401);
  });
});
