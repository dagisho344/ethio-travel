/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  BadRequestException,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Server } from 'node:http';
import request from 'supertest';

type JsonBody = { data: Array<Record<string, unknown>> };
import { AppModule } from '../src/app.module';
import { MapsService } from '../src/maps/maps.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import { SearchEntityType } from '../src/search/dto/search-query.dto';
import { SearchService } from '../src/search/search.service';

const publicResult = {
  type: SearchEntityType.BUSINESS,
  id: 'business',
  name: 'Verified Hotel',
  slug: 'verified-hotel',
  shortDescription: 'Public hotel',
  latitude: '6.200000',
  longitude: '37.200000',
  category: { code: 'HOTEL', name: 'Hotel' },
  location: {
    city: { name: 'Sodo', slug: 'sodo' },
    region: { name: 'South Ethiopia', slug: 'south-ethiopia' },
  },
};

const searchPage = {
  data: [publicResult],
  meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
};

const markerPage = {
  data: [
    {
      type: SearchEntityType.BUSINESS,
      id: 'business',
      name: 'Verified Hotel',
      slug: 'verified-hotel',
      latitude: '6.200000',
      longitude: '37.200000',
      category: { code: 'HOTEL', name: 'Hotel' },
      location: publicResult.location,
    },
  ],
};

describe('Phase 5 search and map routes', () => {
  let app: INestApplication | undefined;
  let httpServer: Server;
  const search = jest.fn(() => Promise.resolve(searchPage));
  const findPlaces = jest.fn(
    (query: { north: number; south: number; east: number; west: number }) => {
      if (query.south > query.north)
        throw new BadRequestException('south cannot be greater than north.');
      if (query.west > query.east)
        throw new BadRequestException('west cannot be greater than east.');
      return Promise.resolve(markerPage);
    },
  );

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({ isHealthy: () => Promise.resolve(true) })
      .overrideProvider(RedisService)
      .useValue({ isHealthy: () => Promise.resolve(true) })
      .overrideProvider(SearchService)
      .useValue({ search })
      .overrideProvider(MapsService)
      .useValue({ findPlaces })
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
    search.mockClear();
    findPlaces.mockClear();
  });

  it('serves public search without authentication and does not leak private fields', async () => {
    const response = await request(httpServer)
      .get(
        '/api/v1/search?q=hotel&types=business,service&businessCategory=HOTEL',
      )
      .expect(200);
    expect(search).toHaveBeenCalledWith(
      expect.objectContaining({
        q: 'hotel',
        types: [SearchEntityType.BUSINESS, SearchEntityType.SERVICE],
        businessCategory: 'HOTEL',
      }),
    );
    expect((response.body as JsonBody).data[0]).toEqual(
      expect.not.objectContaining({
        verificationSummary: expect.anything(),
        adminNotes: expect.anything(),
        storageKey: expect.anything(),
        createdByUserId: expect.anything(),
      }),
    );
  });

  it('rejects malformed search query values with 400', async () => {
    await request(httpServer).get('/api/v1/search?types=booking').expect(400);
    await request(httpServer).get('/api/v1/search?limit=101').expect(400);
    await request(httpServer)
      .get('/api/v1/search?businessCategory=hotel')
      .expect(400);
  });

  it('serves public map markers with filters', async () => {
    const response = await request(httpServer)
      .get(
        '/api/v1/map/places?north=10&south=0&east=40&west=30&types=business&citySlug=sodo',
      )
      .expect(200);
    expect(findPlaces).toHaveBeenCalledWith(
      expect.objectContaining({
        north: 10,
        south: 0,
        east: 40,
        west: 30,
        types: [SearchEntityType.BUSINESS],
        citySlug: 'sodo',
      }),
    );
    expect((response.body as JsonBody).data[0]).toEqual(
      expect.not.objectContaining({
        verificationSummary: expect.anything(),
        members: expect.anything(),
        storageKey: expect.anything(),
      }),
    );
  });

  it('rejects invalid map bounds with 400', async () => {
    await request(httpServer)
      .get('/api/v1/map/places?north=91&south=0&east=40&west=30')
      .expect(400);
    await request(httpServer)
      .get('/api/v1/map/places?north=10&south=11&east=40&west=30')
      .expect(400);
    await request(httpServer)
      .get('/api/v1/map/places?north=10&south=0&east=20&west=30')
      .expect(400);
  });
});
