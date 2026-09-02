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
      sort: SearchSort.PRICE_ASC,
      types: [SearchEntityType.SERVICE],
      minPrice: 5,
      maxPrice: 50,
      pricingModel: PricingModel.FIXED,
    });
    expect(prisma.service.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          pricingModel: PricingModel.FIXED,
          price: { gte: 5, lte: 50 },
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
