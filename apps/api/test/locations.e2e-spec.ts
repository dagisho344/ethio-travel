import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  AttractionCategory,
  LocationStatus,
  PublicationStatus,
} from '@prisma/client';
import type { Server } from 'node:http';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AuthenticatedUser } from '../src/auth/authenticated-user';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { AttractionsService } from '../src/attractions/attractions.service';
import { CitiesService } from '../src/cities/cities.service';
import { DestinationsService } from '../src/destinations/destinations.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import { RegionsService } from '../src/regions/regions.service';

interface PaginatedBody<T> {
  data: T[];
  meta: { total: number };
}

const region = {
  createdAt: new Date().toISOString(),
  description: null,
  id: '11111111-1111-1111-1111-111111111111',
  name: 'South Ethiopia Regional State',
  slug: 'south-ethiopia-regional-state',
  status: LocationStatus.ACTIVE,
  updatedAt: new Date().toISOString(),
};

const city = {
  createdAt: new Date().toISOString(),
  description: null,
  id: '22222222-2222-2222-2222-222222222222',
  latitude: '6.855000',
  longitude: '37.761000',
  name: 'Wolaita Sodo',
  regionId: region.id,
  slug: 'wolaita-sodo',
  status: LocationStatus.ACTIVE,
  updatedAt: new Date().toISOString(),
};

const destination = {
  archivedAt: null,
  cityId: city.id,
  createdAt: new Date().toISOString(),
  fullDescription: 'Development destination detail.',
  id: '33333333-3333-3333-3333-333333333333',
  latitude: '6.855000',
  longitude: '37.761000',
  name: 'Sample Destination',
  publishedAt: new Date().toISOString(),
  shortDescription: 'Development destination.',
  slug: 'sample-destination',
  status: PublicationStatus.PUBLISHED,
  travelInfo: null,
  updatedAt: new Date().toISOString(),
};

const attraction = {
  archivedAt: null,
  category: AttractionCategory.OTHER,
  contactInfo: null,
  createdAt: new Date().toISOString(),
  currency: null,
  description: 'Development sample attraction.',
  destinationId: destination.id,
  entranceFee: null,
  id: '44444444-4444-4444-4444-444444444444',
  latitude: '6.855000',
  longitude: '37.761000',
  name: 'Sample Attraction',
  openingInfo: null,
  publishedAt: new Date().toISOString(),
  slug: 'sample-attraction',
  status: PublicationStatus.PUBLISHED,
  updatedAt: new Date().toISOString(),
};

let currentRoles: string[] = ['ADMIN'];
let allowAuth = true;

class TestJwtGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    if (!allowAuth) {
      throw new UnauthorizedException();
    }

    const user: AuthenticatedUser = {
      email: 'admin@example.com',
      roles: currentRoles,
      sessionId: '55555555-5555-5555-5555-555555555555',
      sub: '66666666-6666-6666-6666-666666666666',
    };
    context.switchToHttp().getRequest<{ user: AuthenticatedUser }>().user =
      user;
    return true;
  }
}

describe('Phase 2 location routes', () => {
  let app: INestApplication | undefined;
  let httpServer: Server;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({ isHealthy: () => Promise.resolve(true) })
      .overrideProvider(RedisService)
      .useValue({ isHealthy: () => Promise.resolve(true) })
      .overrideProvider(RegionsService)
      .useValue({
        create: () => Promise.resolve(region),
        findAdmin: () =>
          Promise.resolve({
            data: [region],
            meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
          }),
        findAdminById: () => Promise.resolve(region),
        findPublic: () =>
          Promise.resolve({
            data: [region],
            meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
          }),
        findPublicBySlug: () => Promise.resolve(region),
        update: () => Promise.resolve(region),
      })
      .overrideProvider(CitiesService)
      .useValue({
        create: () => Promise.resolve(city),
        findAdmin: () =>
          Promise.resolve({
            data: [city],
            meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
          }),
        findAdminById: () => Promise.resolve(city),
        findPublic: () =>
          Promise.resolve({
            data: [city],
            meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
          }),
        findPublicByRegion: () =>
          Promise.resolve({
            data: [city],
            meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
          }),
        findPublicBySlugs: () => Promise.resolve(city),
        update: () => Promise.resolve(city),
      })
      .overrideProvider(DestinationsService)
      .useValue({
        create: () => Promise.resolve(destination),
        findAdmin: () =>
          Promise.resolve({
            data: [destination],
            meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
          }),
        findAdminById: () => Promise.resolve(destination),
        findPublic: () =>
          Promise.resolve({
            data: [destination],
            meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
          }),
        findPublicByCitySlugs: () =>
          Promise.resolve({
            data: [destination],
            meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
          }),
        findPublicBySlugs: () => Promise.resolve(destination),
        update: () => Promise.resolve(destination),
      })
      .overrideProvider(AttractionsService)
      .useValue({
        create: () => Promise.resolve(attraction),
        findAdmin: () =>
          Promise.resolve({
            data: [attraction],
            meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
          }),
        findAdminById: () => Promise.resolve(attraction),
        findPublic: () =>
          Promise.resolve({
            data: [attraction],
            meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
          }),
        findPublicByDestinationSlugs: () =>
          Promise.resolve({
            data: [attraction],
            meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
          }),
        findPublicBySlugs: () => Promise.resolve(attraction),
        update: () => Promise.resolve(attraction),
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

  it('serves paginated public collection endpoints', async () => {
    await request(httpServer)
      .get('/api/v1/regions')
      .expect(200)
      .expect(({ body }: { body: PaginatedBody<typeof region> }) =>
        expect(body.meta.total).toBe(1),
      );
    await request(httpServer)
      .get('/api/v1/cities')
      .expect(200)
      .expect(({ body }: { body: PaginatedBody<typeof city> }) =>
        expect(body.data[0]?.slug).toBe(city.slug),
      );
    await request(httpServer)
      .get('/api/v1/destinations')
      .expect(200)
      .expect(({ body }: { body: PaginatedBody<typeof destination> }) =>
        expect(body.data[0]?.slug).toBe(destination.slug),
      );
    await request(httpServer)
      .get('/api/v1/attractions')
      .expect(200)
      .expect(({ body }: { body: PaginatedBody<typeof attraction> }) =>
        expect(body.data[0]?.slug).toBe(attraction.slug),
      );
  });

  it('serves hierarchical public detail routes', async () => {
    await request(httpServer)
      .get('/api/v1/regions/south-ethiopia-regional-state')
      .expect(200);
    await request(httpServer)
      .get('/api/v1/regions/south-ethiopia-regional-state/cities/wolaita-sodo')
      .expect(200);
    await request(httpServer)
      .get(
        '/api/v1/regions/south-ethiopia-regional-state/cities/wolaita-sodo/destinations/sample-destination',
      )
      .expect(200);
    await request(httpServer)
      .get(
        '/api/v1/regions/south-ethiopia-regional-state/cities/wolaita-sodo/destinations/sample-destination/attractions/sample-attraction',
      )
      .expect(200);
  });

  it('serves hierarchical public nested collection routes', async () => {
    await request(httpServer)
      .get('/api/v1/regions/south-ethiopia-regional-state/cities')
      .expect(200);
    await request(httpServer)
      .get(
        '/api/v1/regions/south-ethiopia-regional-state/cities/wolaita-sodo/destinations',
      )
      .expect(200);
    await request(httpServer)
      .get(
        '/api/v1/regions/south-ethiopia-regional-state/cities/wolaita-sodo/destinations/sample-destination/attractions',
      )
      .expect(200);
  });

  it('requires authentication for admin write routes', async () => {
    allowAuth = false;
    await request(httpServer)
      .post('/api/v1/admin/regions')
      .send({ name: 'Test Region' })
      .expect(401);
  });

  it('requires ADMIN for admin write routes', async () => {
    currentRoles = ['TRAVELER'];
    await request(httpServer)
      .post('/api/v1/admin/regions')
      .send({ name: 'Test Region' })
      .expect(403);
  });

  it('validates admin DTOs and rejects unknown JSON keys', async () => {
    await request(httpServer)
      .post('/api/v1/admin/cities')
      .send({
        latitude: 100,
        longitude: 37.761,
        name: 'Invalid City',
        regionId: region.id,
      })
      .expect(400);

    await request(httpServer)
      .post('/api/v1/admin/destinations')
      .send({
        cityId: city.id,
        fullDescription: 'Full description',
        latitude: 6.855,
        longitude: 37.761,
        name: 'Destination',
        shortDescription: 'Short description',
        travelInfo: { unknown: 'blocked' },
      })
      .expect(400);

    await request(httpServer)
      .post('/api/v1/admin/attractions')
      .send({
        category: AttractionCategory.OTHER,
        description: 'Sample attraction.',
        destinationId: destination.id,
        entranceFee: 10,
        latitude: 6.855,
        longitude: 37.761,
        name: 'Attraction',
      })
      .expect(400);
  });

  it('does not expose DELETE endpoints', async () => {
    await request(httpServer)
      .delete('/api/v1/admin/regions/11111111-1111-1111-1111-111111111111')
      .expect(404);
  });
});
