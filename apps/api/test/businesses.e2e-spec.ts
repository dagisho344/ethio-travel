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
import { BusinessCategoriesService } from '../src/business-categories/business-categories.service';
import { BusinessMembersService } from '../src/business-members/business-members.service';
import { BusinessVerificationsService } from '../src/business-verifications/business-verifications.service';
import { BusinessesService } from '../src/businesses/businesses.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';

let allowAuth = true;
let currentRoles: string[] = ['ADMIN'];
const user: AuthenticatedUser = {
  email: 'admin@example.com',
  roles: currentRoles,
  sessionId: 's',
  sub: '11111111-1111-4111-8111-111111111111',
};
const business = {
  id: '22222222-2222-4222-8222-222222222222',
  name: 'Sodo Sample Hotel',
  slug: 'sodo-sample-hotel',
};
const page = {
  data: [business],
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

describe('Phase 3 business routes', () => {
  let app: INestApplication | undefined;
  let httpServer: Server;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({ isHealthy: () => Promise.resolve(true) })
      .overrideProvider(RedisService)
      .useValue({ isHealthy: () => Promise.resolve(true) })
      .overrideProvider(BusinessCategoriesService)
      .useValue({
        create: () => Promise.resolve({ code: 'HOTEL' }),
        findAdmin: () => Promise.resolve(page),
        findPublic: () => Promise.resolve(page),
        update: () => Promise.resolve({ code: 'HOTEL' }),
      })
      .overrideProvider(BusinessesService)
      .useValue({
        create: () => Promise.resolve(business),
        findAdmin: () => Promise.resolve(page),
        findAdminById: () => Promise.resolve(business),
        findMine: () => Promise.resolve(page),
        findMineById: () => Promise.resolve(business),
        findPublic: () => Promise.resolve(page),
        findPublicBySlugs: () => Promise.resolve(business),
        updateAdmin: () => Promise.resolve(business),
        updateMine: () => Promise.resolve(business),
      })
      .overrideProvider(BusinessMembersService)
      .useValue({
        createMember: () => Promise.resolve({ id: 'member' }),
        findMembers: () => Promise.resolve([{ id: 'member' }]),
        updateMember: () => Promise.resolve({ id: 'member' }),
      })
      .overrideProvider(BusinessVerificationsService)
      .useValue({
        approve: () => Promise.resolve({ id: 'verification' }),
        findAdmin: () => Promise.resolve(page),
        findAdminById: () => Promise.resolve({ id: 'verification' }),
        findMine: () => Promise.resolve(page),
        findMineById: () => Promise.resolve({ id: 'verification' }),
        reject: () => Promise.resolve({ id: 'verification' }),
        submit: () => Promise.resolve({ id: 'verification' }),
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

  it('serves public business routes', async () => {
    await request(httpServer).get('/api/v1/business-categories').expect(200);
    await request(httpServer).get('/api/v1/businesses').expect(200);
    await request(httpServer)
      .get(
        '/api/v1/regions/south-ethiopia-regional-state/cities/wolaita-sodo/businesses',
      )
      .expect(200);
    await request(httpServer)
      .get(
        '/api/v1/regions/south-ethiopia-regional-state/cities/wolaita-sodo/businesses/sodo-sample-hotel',
      )
      .expect(200);
    await request(httpServer)
      .get(
        '/api/v1/regions/south-ethiopia-regional-state/cities/wolaita-sodo/destinations/sample-destination/businesses',
      )
      .expect(200);
  });

  it('requires authentication for business creation and my routes', async () => {
    allowAuth = false;
    await request(httpServer).post('/api/v1/businesses').send({}).expect(401);
    await request(httpServer).get('/api/v1/my/businesses').expect(401);
  });

  it('serves my business, member and verification routes when authenticated', async () => {
    await request(httpServer)
      .post('/api/v1/businesses')
      .send({
        addressLine1: 'Main road',
        categoryId: '44444444-4444-4444-8444-444444444444',
        cityId: '33333333-3333-4333-8333-333333333333',
        description: 'A valid development business description.',
        latitude: 6.855,
        longitude: 37.761,
        name: 'Sodo Sample Hotel',
      })
      .expect(201);
    await request(httpServer).get('/api/v1/my/businesses').expect(200);
    await request(httpServer)
      .patch('/api/v1/my/businesses/22222222-2222-4222-8222-222222222222')
      .send({ name: 'Updated Business' })
      .expect(200);
    await request(httpServer)
      .get('/api/v1/my/businesses/22222222-2222-4222-8222-222222222222/members')
      .expect(200);
    await request(httpServer)
      .post(
        '/api/v1/my/businesses/22222222-2222-4222-8222-222222222222/members',
      )
      .send({ role: 'STAFF', userId: '11111111-1111-4111-8111-111111111111' })
      .expect(201);
    await request(httpServer)
      .post(
        '/api/v1/my/businesses/22222222-2222-4222-8222-222222222222/verifications',
      )
      .send({})
      .expect(201);
  });

  it('requires ADMIN for admin business routes', async () => {
    currentRoles = ['TRAVELER'];
    await request(httpServer).get('/api/v1/admin/businesses').expect(403);
    currentRoles = ['ADMIN'];
    await request(httpServer).get('/api/v1/admin/businesses').expect(200);
    await request(httpServer)
      .post('/api/v1/admin/business-verifications/verification/approve')
      .send({})
      .expect(200);
    await request(httpServer)
      .post('/api/v1/admin/business-verifications/verification/reject')
      .send({ rejectionReason: 'Missing document.' })
      .expect(200);
  });

  it('does not expose DELETE endpoints', async () => {
    await request(httpServer)
      .delete('/api/v1/businesses/22222222-2222-4222-8222-222222222222')
      .expect(404);
  });
});
