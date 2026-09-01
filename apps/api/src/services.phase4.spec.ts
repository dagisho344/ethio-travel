/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument */
import { BadRequestException, ConflictException } from '@nestjs/common';
import {
  BusinessMemberRole,
  BusinessStatus,
  BusinessVerificationSummary,
  LocationStatus,
  MediaRole,
  MediaStatus,
  MediaVisibility,
  PricingModel,
  ServiceLocationMode,
  ServiceStatus,
} from '@prisma/client';
import { BusinessesService } from './businesses/businesses.service';
import { assertMediaRoleAllowed, toPublicMedia } from './media/media-policy';
import { PrismaService } from './prisma/prisma.service';
import { CreateServiceDto } from './services/dto/create-service.dto';
import { ServicesService } from './services/services.service';

const userId = '11111111-1111-4111-8111-111111111111';
const businessId = '22222222-2222-4222-8222-222222222222';
const categoryId = '33333333-3333-4333-8333-333333333333';
const serviceId = '44444444-4444-4444-8444-444444444444';

function prismaMock() {
  const tx: any = {};
  const delegate = () => ({
    count: jest.fn(() => Promise.resolve(0)),
    create: jest.fn((args: any) => Promise.resolve(serviceRecord(args.data))),
    findFirst: jest.fn(() => Promise.resolve(null)),
    findMany: jest.fn(() => Promise.resolve([])),
    findUnique: jest.fn(() => Promise.resolve(null)),
    findUniqueOrThrow: jest.fn((args: any) =>
      Promise.resolve(serviceRecord({ id: args.where.id })),
    ),
    update: jest.fn((args: any) =>
      Promise.resolve(serviceRecord({ id: args.where.id, ...args.data })),
    ),
    updateMany: jest.fn(() => Promise.resolve({ count: 1 })),
  });
  Object.assign(tx, {
    service: delegate(),
    serviceCategory: delegate(),
    user: delegate(),
    businessMember: delegate(),
  });
  tx.$transaction = jest.fn((arg: any) =>
    Array.isArray(arg) ? Promise.all(arg) : arg(tx),
  );
  return tx;
}

function serviceRecord(overrides: any = {}) {
  return {
    id: serviceId,
    businessId,
    categoryId,
    name: 'Standard Room',
    slug: 'standard-room',
    shortDescription: 'A clean room for travelers.',
    description: 'A clean room for travelers staying in the city.',
    price: null,
    currency: null,
    pricingModel: PricingModel.FREE,
    durationMinutes: null,
    minGuests: null,
    maxGuests: null,
    locationMode: ServiceLocationMode.BUSINESS_LOCATION,
    address: null,
    latitude: null,
    longitude: null,
    attributes: null,
    status: ServiceStatus.DRAFT,
    publishedAt: null,
    archivedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    category: { id: categoryId, code: 'ROOM', name: 'Room', isActive: true },
    business: {
      id: businessId,
      name: 'Verified Hotel',
      slug: 'verified-hotel',
      status: BusinessStatus.ACTIVE,
      verificationSummary: BusinessVerificationSummary.VERIFIED,
      destinationId: null,
      category: { code: 'HOTEL', name: 'Hotel', isActive: true },
      city: {
        name: 'Sodo',
        slug: 'sodo',
        status: LocationStatus.ACTIVE,
        region: {
          name: 'South Ethiopia',
          slug: 'south-ethiopia',
          status: LocationStatus.ACTIVE,
        },
      },
      destination: null,
    },
    ...overrides,
  };
}

const createDto: CreateServiceDto = {
  categoryId,
  name: 'Standard Room',
  shortDescription: 'A clean room for travelers.',
  description: 'A clean room for travelers staying in the city.',
  pricingModel: PricingModel.FREE,
};

type InvalidServiceDto = Omit<CreateServiceDto, 'attributes'> & {
  attributes?: unknown;
} & Record<string, unknown>;

type InvalidServiceCase = {
  name: string;
  dto: InvalidServiceDto;
};

const invalidServiceCases: InvalidServiceCase[] = [
  { name: 'FREE + currency', dto: { ...createDto, currency: 'ETB' } },
  { name: 'FREE non-zero price', dto: { ...createDto, price: 1 } },
  {
    name: 'CONTACT price',
    dto: {
      ...createDto,
      pricingModel: PricingModel.CONTACT_FOR_PRICE,
      price: 1,
    },
  },
  {
    name: 'CONTACT currency',
    dto: {
      ...createDto,
      pricingModel: PricingModel.CONTACT_FOR_PRICE,
      currency: 'ETB',
    },
  },
  {
    name: 'paid missing price',
    dto: { ...createDto, pricingModel: PricingModel.FIXED },
  },
  {
    name: 'paid missing currency',
    dto: { ...createDto, pricingModel: PricingModel.FIXED, price: 10 },
  },
  {
    name: 'lowercase currency',
    dto: {
      ...createDto,
      pricingModel: PricingModel.FIXED,
      price: 10,
      currency: 'etb',
    },
  },
  {
    name: 'negative price',
    dto: {
      ...createDto,
      pricingModel: PricingModel.FIXED,
      price: -1,
      currency: 'ETB',
    },
  },
  { name: 'guest range', dto: { ...createDto, minGuests: 4, maxGuests: 2 } },
  {
    name: 'business custom location',
    dto: {
      ...createDto,
      locationMode: ServiceLocationMode.BUSINESS_LOCATION,
      address: 'Road',
    },
  },
  {
    name: 'custom missing longitude',
    dto: {
      ...createDto,
      locationMode: ServiceLocationMode.CUSTOM_LOCATION,
      address: 'Road',
      latitude: 6,
    },
  },
  {
    name: 'mobile partial coordinate',
    dto: {
      ...createDto,
      locationMode: ServiceLocationMode.MOBILE_VARIABLE,
      latitude: 6,
    },
  },
  {
    name: 'unknown attributes',
    dto: { ...createDto, attributes: { mystery: ['x'] } },
  },
  {
    name: 'too many attributes',
    dto: {
      ...createDto,
      attributes: { tags: Array.from({ length: 31 }, () => 'x') },
    },
  },
];

function service(prisma: any) {
  const businesses = new BusinessesService(prisma as PrismaService);
  jest
    .spyOn(businesses, 'requireMembership')
    .mockResolvedValue({ role: BusinessMemberRole.OWNER } as any);
  return new ServicesService(prisma as PrismaService, businesses);
}

describe('Phase 4 services', () => {
  it('creates draft services for active owner/manager memberships', async () => {
    const prisma = prismaMock();
    prisma.user.findFirst.mockResolvedValue({ id: userId });
    prisma.serviceCategory.findFirst.mockResolvedValue({
      id: categoryId,
      isActive: true,
    });
    await service(prisma).create(userId, businessId, createDto);
    expect(prisma.service.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          business: { connect: { id: businessId } },
          status: ServiceStatus.DRAFT,
          slug: 'standard-room',
        }),
      }),
    );
  });

  it('maps duplicate business scoped slugs to conflict', async () => {
    const prisma = prismaMock();
    prisma.user.findFirst.mockResolvedValue({ id: userId });
    prisma.serviceCategory.findFirst.mockResolvedValue({
      id: categoryId,
      isActive: true,
    });
    prisma.service.findUnique.mockResolvedValue({ id: serviceId });
    await expect(
      service(prisma).create(userId, businessId, createDto),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it.each(invalidServiceCases)(
    'rejects invalid service payload: $name',
    async ({ dto }) => {
      const prisma = prismaMock();
      prisma.user.findFirst.mockResolvedValue({ id: userId });
      prisma.serviceCategory.findFirst.mockResolvedValue({
        id: categoryId,
        isActive: true,
      });
      await expect(
        service(prisma).create(userId, businessId, dto as CreateServiceDto),
      ).rejects.toBeInstanceOf(BadRequestException);
    },
  );

  it('rejects publish under ineligible parent business', async () => {
    const prisma = prismaMock();
    prisma.user.findFirst.mockResolvedValue({ id: userId });
    prisma.service.findFirst.mockResolvedValue(
      serviceRecord({
        business: {
          ...serviceRecord().business,
          status: BusinessStatus.SUSPENDED,
        },
      }),
    );
    await expect(
      service(prisma).publishMine(userId, businessId, serviceId),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('sets publishedAt only on first publish and preserves on unpublish', async () => {
    const prisma = prismaMock();
    prisma.user.findFirst.mockResolvedValue({ id: userId });
    prisma.service.findFirst.mockResolvedValue(
      serviceRecord({ publishedAt: null }),
    );
    await service(prisma).publishMine(userId, businessId, serviceId);
    expect(prisma.service.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: ServiceStatus.PUBLISHED,
          publishedAt: expect.any(Date),
        }),
      }),
    );
    prisma.service.findFirst.mockResolvedValue(
      serviceRecord({
        status: ServiceStatus.PUBLISHED,
        publishedAt: new Date('2026-01-01T00:00:00Z'),
      }),
    );
    prisma.service.findUnique.mockResolvedValue(
      serviceRecord({ status: ServiceStatus.INACTIVE }),
    );
    await service(prisma).unpublishMine(userId, businessId, serviceId);
    expect(prisma.service.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ data: { status: ServiceStatus.INACTIVE } }),
    );
  });

  it('keeps archive terminal', async () => {
    const prisma = prismaMock();
    prisma.user.findFirst.mockResolvedValue({ id: userId });
    prisma.service.findFirst.mockResolvedValue(
      serviceRecord({ status: ServiceStatus.ARCHIVED }),
    );
    await expect(
      service(prisma).archiveMine(userId, businessId, serviceId),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('Phase 4 media policy', () => {
  it('rejects LOGO for non-business attachments', () => {
    expect(() => assertMediaRoleAllowed('service', MediaRole.LOGO)).toThrow(
      BadRequestException,
    );
    expect(() => assertMediaRoleAllowed('destination', MediaRole.LOGO)).toThrow(
      BadRequestException,
    );
    expect(() => assertMediaRoleAllowed('attraction', MediaRole.LOGO)).toThrow(
      BadRequestException,
    );
  });

  it('only exposes safe READY public media fields', () => {
    const mapped = toPublicMedia({
      id: 'm',
      originalFilename: 'photo.jpg',
      mimeType: 'image/jpeg',
      mediaType: 'IMAGE',
      width: 1,
      height: 1,
      durationSeconds: null,
      status: MediaStatus.READY,
      visibility: MediaVisibility.PUBLIC,
    });
    expect(mapped).toEqual(
      expect.not.objectContaining({
        storageKey: expect.anything(),
        checksum: expect.anything(),
        createdByUserId: expect.anything(),
      }),
    );
    expect(
      toPublicMedia({
        ...mapped!,
        status: MediaStatus.PENDING_UPLOAD,
        visibility: MediaVisibility.PUBLIC,
      }),
    ).toBeNull();
    expect(
      toPublicMedia({
        ...mapped!,
        status: MediaStatus.READY,
        visibility: MediaVisibility.PRIVATE,
      }),
    ).toBeNull();
  });
});
