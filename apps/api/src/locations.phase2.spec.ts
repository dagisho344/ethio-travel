/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment */
import { BadRequestException, ConflictException } from '@nestjs/common';
import {
  AttractionCategory,
  LocationStatus,
  PublicationStatus,
} from '@prisma/client';
import { AttractionsService } from './attractions/attractions.service';
import { CitiesService } from './cities/cities.service';
import { DestinationsService } from './destinations/destinations.service';
import { RegionsService } from './regions/regions.service';
import { PrismaService } from './prisma/prisma.service';

const id = '11111111-1111-1111-1111-111111111111';
const parentId = '22222222-2222-2222-2222-222222222222';

type DelegateMock = {
  count: jest.Mock<Promise<number>, any[]>;
  create: jest.Mock<Promise<unknown>, any[]>;
  findFirst: jest.Mock<Promise<unknown>, any[]>;
  findMany: jest.Mock<Promise<unknown[]>, any[]>;
  findUnique: jest.Mock<Promise<unknown>, any[]>;
  update: jest.Mock<Promise<unknown>, any[]>;
};

type PrismaMock = {
  $transaction: jest.Mock<Promise<unknown[]>, [Array<Promise<unknown>>]>;
  attraction: DelegateMock;
  city: DelegateMock;
  destination: DelegateMock;
  region: DelegateMock;
};

function createDelegateMock(): DelegateMock {
  return {
    count: jest.fn(() => Promise.resolve(0)),
    create: jest.fn((args: { data: object }) =>
      Promise.resolve({ id, ...args.data }),
    ),
    findFirst: jest.fn(() => Promise.resolve(null)),
    findMany: jest.fn(() => Promise.resolve([])),
    findUnique: jest.fn(() => Promise.resolve(null)),
    update: jest.fn((args: { data: object }) =>
      Promise.resolve({ id, ...args.data }),
    ),
  };
}

function createPrismaMock(): PrismaMock {
  return {
    $transaction: jest.fn((queries: Array<Promise<unknown>>) =>
      Promise.all(queries),
    ),
    attraction: createDelegateMock(),
    city: createDelegateMock(),
    destination: createDelegateMock(),
    region: createDelegateMock(),
  };
}

describe('Phase 2 location services', () => {
  it('generates slugs and rejects duplicate region slugs', async () => {
    const prisma = createPrismaMock();
    const service = new RegionsService(prisma as unknown as PrismaService);

    await expect(
      service.create({ name: 'South Ethiopia Regional State' }),
    ).resolves.toMatchObject({
      slug: 'south-ethiopia-regional-state',
    });

    prisma.region.findUnique.mockResolvedValueOnce({
      id,
      slug: 'south-ethiopia-regional-state',
    });
    await expect(
      service.create({ name: 'South Ethiopia Regional State' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('keeps city slug uniqueness scoped to region', async () => {
    const prisma = createPrismaMock();
    prisma.region.findUnique.mockResolvedValue({ id: parentId });
    prisma.city.findUnique.mockResolvedValueOnce({ id, slug: 'wolaita-sodo' });
    const service = new CitiesService(prisma as unknown as PrismaService);

    await expect(
      service.create({
        latitude: 6.855,
        longitude: 37.761,
        name: 'Wolaita Sodo',
        regionId: parentId,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('applies parent visibility to public destination collections', async () => {
    const prisma = createPrismaMock();
    const service = new DestinationsService(prisma as unknown as PrismaService);

    await service.findPublic({ page: 1, limit: 20 });

    expect(prisma.destination.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: PublicationStatus.PUBLISHED,
          city: {
            status: LocationStatus.ACTIVE,
            region: { status: LocationStatus.ACTIVE },
          },
        }),
      }),
    );
  });

  it('blocks destination publishing when city or region is inactive', async () => {
    const prisma = createPrismaMock();
    prisma.city.findUnique.mockResolvedValue({ id: parentId });
    prisma.city.findFirst.mockResolvedValue(null);
    const service = new DestinationsService(prisma as unknown as PrismaService);

    await expect(
      service.create({
        cityId: parentId,
        fullDescription: 'Full description',
        latitude: 6.855,
        longitude: 37.761,
        name: 'Sodo',
        shortDescription: 'Short description',
        status: PublicationStatus.PUBLISHED,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('sets publication timestamps in the service and keeps archived terminal', async () => {
    const prisma = createPrismaMock();
    prisma.city.findUnique.mockResolvedValue({ id: parentId });
    prisma.city.findFirst.mockResolvedValue({ id: parentId });
    const service = new DestinationsService(prisma as unknown as PrismaService);

    await service.create({
      cityId: parentId,
      fullDescription: 'Full description',
      latitude: 6.855,
      longitude: 37.761,
      name: 'Sodo',
      shortDescription: 'Short description',
      status: PublicationStatus.PUBLISHED,
    });

    expect(prisma.destination.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ publishedAt: expect.any(Date) }),
      }),
    );

    prisma.destination.findUnique.mockResolvedValueOnce({
      archivedAt: new Date(),
      cityId: parentId,
      id,
      publishedAt: new Date(),
      slug: 'sodo',
      status: PublicationStatus.ARCHIVED,
    });

    await expect(
      service.update(id, { status: PublicationStatus.PUBLISHED }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('requires currency when attraction entrance fee is present', async () => {
    const prisma = createPrismaMock();
    const service = new AttractionsService(prisma as unknown as PrismaService);

    await expect(
      service.create({
        category: AttractionCategory.OTHER,
        description: 'Sample attraction for development tests.',
        destinationId: parentId,
        entranceFee: 10,
        latitude: 6.855,
        longitude: 37.761,
        name: 'Sample Attraction',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('blocks attraction publishing when destination chain is not public', async () => {
    const prisma = createPrismaMock();
    prisma.destination.findUnique.mockResolvedValue({ id: parentId });
    prisma.destination.findFirst.mockResolvedValue(null);
    const service = new AttractionsService(prisma as unknown as PrismaService);

    await expect(
      service.create({
        category: AttractionCategory.OTHER,
        currency: 'ETB',
        description: 'Sample attraction for development tests.',
        destinationId: parentId,
        entranceFee: 10,
        latitude: 6.855,
        longitude: 37.761,
        name: 'Sample Attraction',
        status: PublicationStatus.PUBLISHED,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
