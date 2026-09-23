/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { BadRequestException } from '@nestjs/common';
import {
  BusinessStatus,
  BusinessVerificationSummary,
  LocationStatus,
  PricingModel,
  PublicationStatus,
  ServiceLocationMode,
  ServiceStatus,
} from '@prisma/client';
import {
  publicBusinessWhere,
  publicDestinationWhere,
  publicServiceWhere,
} from './common/utils/public-visibility.util';
import { MapsService } from './maps/maps.service';
import { PrismaService } from './prisma/prisma.service';
import { SearchEntityType, SearchSort } from './search/dto/search-query.dto';
import { SearchService } from './search/search.service';

function prismaMock() {
  const delegate = () => ({
    count: jest.fn(() => Promise.resolve(0)),
    findMany: jest.fn<Promise<unknown[]>, [unknown?]>(() =>
      Promise.resolve([]),
    ),
  });
  return {
    attraction: delegate(),
    business: delegate(),
    destination: delegate(),
    service: delegate(),
    review: {
      groupBy: jest.fn<Promise<unknown[]>, [unknown?]>(() =>
        Promise.resolve([]),
      ),
    },
  };
}

const region = {
  name: 'South Ethiopia',
  slug: 'south-ethiopia',
  status: LocationStatus.ACTIVE,
};
const city = {
  name: 'Sodo',
  slug: 'sodo',
  status: LocationStatus.ACTIVE,
  region,
};
const destination = {
  id: 'destination',
  name: 'Lake View',
  slug: 'lake-view',
  shortDescription: 'Lake destination',
  fullDescription: 'Lake destination details',
  latitude: 6.1,
  longitude: 37.1,
  status: PublicationStatus.PUBLISHED,
  createdAt: new Date('2026-01-02T00:00:00Z'),
  city,
};
const business = {
  id: 'business',
  name: 'Verified Hotel',
  slug: 'verified-hotel',
  description: 'Public hotel',
  addressLine1: 'Main Road',
  neighborhood: 'Center',
  latitude: 6.2,
  longitude: 37.2,
  status: BusinessStatus.ACTIVE,
  verificationSummary: BusinessVerificationSummary.VERIFIED,
  createdAt: new Date('2026-01-03T00:00:00Z'),
  category: { code: 'HOTEL', name: 'Hotel', isActive: true },
  city,
  destination: null,
};
const serviceRecord = {
  id: 'service',
  name: 'Room',
  slug: 'room',
  shortDescription: 'Room stay',
  description: 'Room stay details',
  latitude: null,
  longitude: null,
  locationMode: ServiceLocationMode.BUSINESS_LOCATION,
  price: 10,
  currency: 'ETB',
  pricingModel: PricingModel.FIXED,
  status: ServiceStatus.PUBLISHED,
  createdAt: new Date('2026-01-04T00:00:00Z'),
  category: { code: 'ROOM', name: 'Room', isActive: true },
  business,
};

describe('Phase 5 public visibility builders', () => {
  it('builds destination visibility with active parents', () => {
    expect(
      publicDestinationWhere({ regionSlug: 'south', citySlug: 'sodo' }),
    ).toEqual(
      expect.objectContaining({
        status: PublicationStatus.PUBLISHED,
        city: expect.objectContaining({
          status: LocationStatus.ACTIVE,
          region: expect.objectContaining({ status: LocationStatus.ACTIVE }),
        }),
      }),
    );
  });

  it('builds business and service visibility with verification and categories', () => {
    expect(publicBusinessWhere({ businessCategory: 'HOTEL' })).toEqual(
      expect.objectContaining({
        status: BusinessStatus.ACTIVE,
        verificationSummary: BusinessVerificationSummary.VERIFIED,
        category: expect.objectContaining({ isActive: true, code: 'HOTEL' }),
      }),
    );
    expect(publicServiceWhere({ serviceCategory: 'ROOM' })).toEqual(
      expect.objectContaining({
        status: ServiceStatus.PUBLISHED,
        category: expect.objectContaining({ isActive: true, code: 'ROOM' }),
      }),
    );
  });
});

describe('Phase 5 search', () => {
  it('searches all supported types by default and returns a correct combined total', async () => {
    const prisma = prismaMock();
    prisma.destination.findMany.mockResolvedValue([destination]);
    prisma.business.findMany.mockResolvedValue([business]);
    prisma.service.findMany.mockResolvedValue([serviceRecord]);
    prisma.destination.count.mockResolvedValue(1);
    prisma.business.count.mockResolvedValue(1);
    prisma.service.count.mockResolvedValue(1);
    const result = await new SearchService(
      prisma as unknown as PrismaService,
    ).search({
      page: 1,
      limit: 20,
      sort: SearchSort.RELEVANCE,
    });
    expect(result.meta.total).toBe(3);
    expect(prisma.attraction.findMany).toHaveBeenCalled();
    expect(result.data.map((item) => item.type)).toEqual(
      expect.arrayContaining([
        SearchEntityType.DESTINATION,
        SearchEntityType.BUSINESS,
        SearchEntityType.SERVICE,
      ]),
    );
  });

  it('honors type filtering and service price filters', async () => {
    const prisma = prismaMock();
    await new SearchService(prisma as unknown as PrismaService).search({
      page: 1,
      limit: 20,
      sort: SearchSort.RELEVANCE,
      types: [SearchEntityType.SERVICE],
      minPrice: 5,
      maxPrice: 50,
      pricingModel: PricingModel.FIXED,
      currency: 'ETB',
    });
    expect(prisma.service.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            expect.objectContaining({
              pricingModel: PricingModel.FIXED,
              currency: 'ETB',
              price: { gte: 5, lte: 50 },
            }),
          ]),
        }),
      }),
    );
    expect(prisma.business.findMany).not.toHaveBeenCalled();
  });

  it('rejects invalid price ranges', async () => {
    await expect(
      new SearchService(prismaMock() as unknown as PrismaService).search({
        page: 1,
        limit: 20,
        sort: SearchSort.RELEVANCE,
        minPrice: 50,
        maxPrice: 5,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('requires a pricing model and currency before comparing service prices', async () => {
    const service = new SearchService(prismaMock() as unknown as PrismaService);
    await expect(
      service.search({
        page: 1,
        limit: 20,
        sort: SearchSort.RELEVANCE,
        types: [SearchEntityType.SERVICE],
        minPrice: 5,
        currency: 'ETB',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.search({
        page: 1,
        limit: 20,
        sort: SearchSort.RELEVANCE,
        types: [SearchEntityType.SERVICE],
        maxPrice: 50,
        pricingModel: PricingModel.FIXED,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
  it('keeps private fields out of normalized results', async () => {
    const prisma = prismaMock();
    prisma.business.findMany.mockResolvedValue([business]);
    prisma.business.count.mockResolvedValue(1);
    const result = await new SearchService(
      prisma as unknown as PrismaService,
    ).search({
      page: 1,
      limit: 20,
      sort: SearchSort.RELEVANCE,
      types: [SearchEntityType.BUSINESS],
    });
    expect(result.data[0]).toEqual(
      expect.not.objectContaining({
        verificationSummary: expect.anything(),
        adminNotes: expect.anything(),
        members: expect.anything(),
      }),
    );
  });
});

describe('Phase 5 maps', () => {
  it('rejects invalid bounding boxes', async () => {
    const service = new MapsService(prismaMock() as unknown as PrismaService);
    await expect(
      service.findPlaces({ north: 1, south: 2, east: 3, west: 2, limit: 200 }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.findPlaces({ north: 2, south: 1, east: 1, west: 2, limit: 200 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('uses business coordinates for BUSINESS_LOCATION service markers', async () => {
    const prisma = prismaMock();
    prisma.service.findMany.mockResolvedValue([serviceRecord]);
    const result = await new MapsService(
      prisma as unknown as PrismaService,
    ).findPlaces({
      north: 10,
      south: 0,
      east: 40,
      west: 30,
      limit: 200,
      types: [SearchEntityType.SERVICE],
    });
    expect(result.data[0]).toEqual(
      expect.objectContaining({
        latitude: business.latitude,
        longitude: business.longitude,
      }),
    );
  });

  it('uses custom coordinates and excludes MOBILE_VARIABLE services without coordinates', async () => {
    const prisma = prismaMock();
    prisma.service.findMany.mockResolvedValue([
      {
        ...serviceRecord,
        id: 'custom',
        locationMode: ServiceLocationMode.CUSTOM_LOCATION,
        latitude: 6.3,
        longitude: 37.3,
      },
      {
        ...serviceRecord,
        id: 'mobile',
        locationMode: ServiceLocationMode.MOBILE_VARIABLE,
        latitude: null,
        longitude: null,
      },
    ]);
    const result = await new MapsService(
      prisma as unknown as PrismaService,
    ).findPlaces({
      north: 10,
      south: 0,
      east: 40,
      west: 30,
      limit: 200,
      types: [SearchEntityType.SERVICE],
    });
    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toEqual(
      expect.objectContaining({ id: 'custom', latitude: 6.3, longitude: 37.3 }),
    );
  });
});

describe('Phase 15 discovery hardening', () => {
  it('validates dependent public scope and bounded Nearby coordinates', async () => {
    const service = new SearchService(prismaMock() as unknown as PrismaService);
    await expect(
      service.search({
        page: 1,
        limit: 20,
        sort: SearchSort.RELEVANCE,
        citySlug: 'sodo',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.search({
        page: 1,
        limit: 20,
        sort: SearchSort.DISTANCE,
        lat: 6.1,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.search({ page: 51, limit: 20, sort: SearchSort.RELEVANCE }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('uses an explicit capped candidate window and real distance for Nearby results', async () => {
    const prisma = prismaMock();
    prisma.destination.findMany.mockResolvedValue([
      destination,
      { ...destination, id: 'far', latitude: 8.9, longitude: 38.7 },
    ]);
    const result = await new SearchService(
      prisma as unknown as PrismaService,
    ).search({
      page: 1,
      limit: 20,
      sort: SearchSort.DISTANCE,
      types: [SearchEntityType.DESTINATION],
      lat: 6.1,
      lng: 37.1,
      radiusKm: 2,
    });
    expect(result.meta.total).toBe(1);
    expect(result.data[0]).toEqual(
      expect.objectContaining({ id: destination.id, distanceKm: 0 }),
    );
    expect(prisma.destination.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 1001 }),
    );
  });

  it('rejects oversized Nearby candidate sets rather than omitting closer results', async () => {
    const prisma = prismaMock();
    prisma.destination.findMany.mockResolvedValue(
      Array.from({ length: 1001 }, (_, index) => ({
        ...destination,
        id: `candidate-${index}`,
      })),
    );
    await expect(
      new SearchService(prisma as unknown as PrismaService).search({
        page: 1,
        limit: 20,
        sort: SearchSort.DISTANCE,
        types: [SearchEntityType.DESTINATION],
        lat: 6.1,
        lng: 37.1,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('orders the complete Nearby candidate set by exact Haversine distance', async () => {
    const prisma = prismaMock();
    prisma.destination.findMany.mockResolvedValue([
      { ...destination, id: 'farther', name: 'A result', latitude: 6.11 },
      { ...destination, id: 'closer', name: 'Z result', latitude: 6.101 },
    ]);
    const result = await new SearchService(
      prisma as unknown as PrismaService,
    ).search({
      page: 1,
      limit: 20,
      sort: SearchSort.DISTANCE,
      types: [SearchEntityType.DESTINATION],
      lat: 6.1,
      lng: 37.1,
      radiusKm: 5,
    });
    expect(result.meta.total).toBe(2);
    expect(result.data.map((item) => item.id)).toEqual(['closer', 'farther']);
    const secondPage = await new SearchService(
      prisma as unknown as PrismaService,
    ).search({
      page: 2,
      limit: 1,
      sort: SearchSort.DISTANCE,
      types: [SearchEntityType.DESTINATION],
      lat: 6.1,
      lng: 37.1,
      radiusKm: 5,
    });
    expect(secondPage.meta).toEqual(
      expect.objectContaining({ total: 2, page: 2, totalPages: 2 }),
    );
    expect(secondPage.data.map((item) => item.id)).toEqual(['farther']);
  });
  it('composes public eligibility with public location text matching and explicit selects', async () => {
    const prisma = prismaMock();
    await new SearchService(prisma as unknown as PrismaService).search({
      page: 1,
      limit: 20,
      sort: SearchSort.RELEVANCE,
      types: [SearchEntityType.BUSINESS],
      q: 'South Ethiopia',
    });
    const searchCall = prisma.business.findMany.mock.calls.at(0);
    if (!searchCall?.[0]) throw new Error('Expected a business search query.');
    const call = searchCall[0] as {
      where: { AND: Array<Record<string, unknown>> };
      select: Record<string, unknown>;
      include?: unknown;
    };
    expect(call.where.AND).toHaveLength(3);
    expect(call.where.AND[1]).toEqual(
      expect.objectContaining({ OR: expect.any(Array) }),
    );
    expect(call.select).toEqual(
      expect.objectContaining({
        category: expect.any(Object),
        city: expect.any(Object),
      }),
    );
    expect(call.include).toBeUndefined();
  });

  it('orders a complete Nearby map candidate set by distance and rejects an oversized one', async () => {
    const prisma = prismaMock();
    prisma.destination.findMany.mockResolvedValue([
      { ...destination, id: 'farther', name: 'A result', latitude: 6.11 },
      { ...destination, id: 'closer', name: 'Z result', latitude: 6.101 },
    ]);
    const service = new MapsService(prisma as unknown as PrismaService);
    const result = await service.findPlaces({
      north: 10,
      south: 0,
      east: 40,
      west: 30,
      limit: 20,
      types: [SearchEntityType.DESTINATION],
      lat: 6.1,
      lng: 37.1,
      radiusKm: 5,
    });
    expect(result.data.map((marker) => marker.id)).toEqual([
      'closer',
      'farther',
    ]);
    expect(prisma.destination.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 1001 }),
    );
    prisma.destination.findMany.mockResolvedValue(
      Array.from({ length: 1001 }, (_, index) => ({
        ...destination,
        id: `candidate-${index}`,
      })),
    );
    await expect(
      service.findPlaces({
        north: 10,
        south: 0,
        east: 40,
        west: 30,
        limit: 20,
        types: [SearchEntityType.DESTINATION],
        lat: 6.1,
        lng: 37.1,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
  it('rejects invalid map scope and returns a fair bounded merge with no broad includes', async () => {
    const prisma = prismaMock();
    const attraction = {
      id: 'attraction',
      name: 'Lake Walk',
      slug: 'lake-walk',
      category: 'NATURE',
      latitude: 6.15,
      longitude: 37.15,
      destination,
    };
    prisma.destination.findMany.mockResolvedValue([destination]);
    prisma.attraction.findMany.mockResolvedValue([attraction]);
    prisma.business.findMany.mockResolvedValue([business]);
    prisma.service.findMany.mockResolvedValue([serviceRecord]);
    const service = new MapsService(prisma as unknown as PrismaService);
    await expect(
      service.findPlaces({
        north: 10,
        south: 0,
        east: 40,
        west: 30,
        limit: 3,
        citySlug: 'sodo',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    const result = await service.findPlaces({
      north: 10,
      south: 0,
      east: 40,
      west: 30,
      limit: 3,
    });
    expect(result.data.map((marker) => marker.type)).toEqual([
      SearchEntityType.DESTINATION,
      SearchEntityType.ATTRACTION,
      SearchEntityType.BUSINESS,
    ]);
    const mapCall = prisma.business.findMany.mock.calls.at(0);
    if (!mapCall?.[0]) throw new Error('Expected a business map query.');
    const businessCall = mapCall[0] as {
      select: Record<string, unknown>;
      include?: unknown;
    };
    expect(businessCall.select).toEqual(expect.any(Object));
    expect(businessCall.include).toBeUndefined();
  });
});
