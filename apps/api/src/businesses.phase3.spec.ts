/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import {
  BusinessMemberRole,
  BusinessMemberStatus,
  BusinessStatus,
  BusinessVerificationSummary,
  VerificationRequestStatus,
} from '@prisma/client';
import { BusinessesService } from './businesses/businesses.service';
import { BusinessMembersService } from './business-members/business-members.service';
import { BusinessVerificationsService } from './business-verifications/business-verifications.service';
import { PrismaService } from './prisma/prisma.service';

const userId = '11111111-1111-4111-8111-111111111111';
const businessId = '22222222-2222-4222-8222-222222222222';
const cityId = '33333333-3333-4333-8333-333333333333';
const categoryId = '44444444-4444-4444-8444-444444444444';

function prismaMock() {
  const tx: any = {};
  const delegate = () => ({
    count: jest.fn(() => Promise.resolve(0)),
    create: jest.fn((args: any) =>
      Promise.resolve({ id: businessId, ...args.data }),
    ),
    findFirst: jest.fn(() => Promise.resolve(null)),
    findMany: jest.fn(() => Promise.resolve([])),
    findUnique: jest.fn(() => Promise.resolve(null)),
    findUniqueOrThrow: jest.fn((args: any) =>
      Promise.resolve({ id: args.where.id }),
    ),
    update: jest.fn((args: any) =>
      Promise.resolve({ id: args.where.id, ...args.data }),
    ),
    updateMany: jest.fn(() => Promise.resolve({ count: 1 })),
  });
  Object.assign(tx, {
    business: delegate(),
    businessCategory: delegate(),
    businessMember: delegate(),
    businessVerification: delegate(),
    city: delegate(),
    destination: delegate(),
    user: delegate(),
  });
  tx.$transaction = jest.fn((arg: any) =>
    Array.isArray(arg) ? Promise.all(arg) : arg(tx),
  );
  return tx;
}

const createDto = {
  addressLine1: 'Main road',
  categoryId,
  cityId,
  description: 'A valid development business description.',
  latitude: 6.855,
  longitude: 37.761,
  name: 'Sodo Sample Hotel',
};

describe('Phase 3 business services', () => {
  it('creates a draft business and active owner membership transactionally', async () => {
    const prisma = prismaMock();
    prisma.user.findFirst.mockResolvedValue({ id: userId });
    prisma.city.findUnique.mockResolvedValue({ id: cityId });
    prisma.businessCategory.findFirst.mockResolvedValue({ id: categoryId });
    prisma.business.create.mockResolvedValue({
      id: businessId,
      ...createDto,
      slug: 'sodo-sample-hotel',
    });
    const service = new BusinessesService(prisma as PrismaService);

    await service.create(userId, createDto);

    expect(prisma.business.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: BusinessStatus.DRAFT,
          verificationSummary: BusinessVerificationSummary.NOT_SUBMITTED,
          slug: 'sodo-sample-hotel',
        }),
      }),
    );
    expect(prisma.businessMember.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          role: BusinessMemberRole.OWNER,
          status: BusinessMemberStatus.ACTIVE,
          userId,
        }),
      }),
    );
  });

  it('does not authorize by global role without business membership', async () => {
    const prisma = prismaMock();
    const service = new BusinessesService(prisma as PrismaService);
    await expect(
      service.requireMembership(userId, businessId, [BusinessMemberRole.OWNER]),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects duplicate city scoped slugs', async () => {
    const prisma = prismaMock();
    prisma.user.findFirst.mockResolvedValue({ id: userId });
    prisma.city.findUnique.mockResolvedValue({ id: cityId });
    prisma.businessCategory.findFirst.mockResolvedValue({ id: categoryId });
    prisma.business.findUnique.mockResolvedValue({ id: businessId });
    const service = new BusinessesService(prisma as PrismaService);
    await expect(service.create(userId, createDto)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('prevents deactivation of the final active owner', async () => {
    const prisma = prismaMock();
    prisma.businessMember.findFirst.mockResolvedValueOnce({
      id: 'owner',
      businessId,
      userId,
      role: BusinessMemberRole.OWNER,
      status: BusinessMemberStatus.ACTIVE,
    });
    prisma.businessMember.findFirst.mockResolvedValueOnce({
      id: 'owner',
      businessId,
      role: BusinessMemberRole.OWNER,
      status: BusinessMemberStatus.ACTIVE,
      business: { status: BusinessStatus.ACTIVE },
    });
    prisma.businessMember.count.mockResolvedValue(0);
    const businesses = new BusinessesService(prisma as PrismaService);
    const service = new BusinessMembersService(
      prisma as PrismaService,
      businesses,
    );

    await expect(
      service.updateMember(userId, businessId, 'owner', {
        status: BusinessMemberStatus.INACTIVE,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('submits verification without documents and caches pending summary', async () => {
    const prisma = prismaMock();
    prisma.businessMember.findFirst.mockResolvedValue({ id: 'member' });
    prisma.user.findFirst.mockResolvedValue({ id: userId });
    prisma.business.findUnique.mockResolvedValue({
      id: businessId,
      status: BusinessStatus.DRAFT,
    });
    const businesses = new BusinessesService(prisma as PrismaService);
    const service = new BusinessVerificationsService(
      prisma as PrismaService,
      businesses,
    );

    await service.submit(userId, businessId);

    expect(prisma.businessVerification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: VerificationRequestStatus.PENDING,
        }),
      }),
    );
    expect(prisma.business.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { verificationSummary: BusinessVerificationSummary.PENDING },
      }),
    );
  });

  it('uses conditional review updates for approval', async () => {
    const prisma = prismaMock();
    prisma.businessVerification.findUnique.mockResolvedValue({
      id: 'verification',
      businessId,
    });
    prisma.business.findUnique.mockResolvedValue({
      id: businessId,
      publishedAt: null,
    });
    const businesses = new BusinessesService(prisma as PrismaService);
    const service = new BusinessVerificationsService(
      prisma as PrismaService,
      businesses,
    );

    await service.approve(
      {
        email: 'admin@example.com',
        roles: ['ADMIN'],
        sessionId: 's',
        sub: userId,
      },
      'verification',
      {},
    );

    expect(prisma.businessVerification.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'verification',
          status: VerificationRequestStatus.PENDING,
        },
      }),
    );
    expect(prisma.business.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: BusinessStatus.ACTIVE,
          verificationSummary: BusinessVerificationSummary.VERIFIED,
          publishedAt: expect.any(Date),
        }),
      }),
    );
  });
  it('returns the active requesters membership role with the private business list', async () => {
    const prisma = prismaMock();
    prisma.business.findMany.mockResolvedValue([
      { id: businessId, ...createDto },
    ]);
    prisma.business.count.mockResolvedValue(1);
    prisma.businessMember.findMany.mockResolvedValue([
      {
        businessId,
        role: BusinessMemberRole.MANAGER,
        status: BusinessMemberStatus.ACTIVE,
      },
    ]);
    const service = new BusinessesService(prisma as PrismaService);

    const result = await service.findMine(userId, { page: 1, limit: 10 });

    expect(result.data[0]).toEqual(
      expect.objectContaining({
        currentMember: {
          role: BusinessMemberRole.MANAGER,
          status: BusinessMemberStatus.ACTIVE,
        },
      }),
    );
    expect(prisma.business.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          members: {
            some: { userId, status: BusinessMemberStatus.ACTIVE },
          },
        }),
      }),
    );
  });

  it('rejects a destination that is outside the selected business city', async () => {
    const prisma = prismaMock();
    prisma.user.findFirst.mockResolvedValue({ id: userId });
    prisma.city.findUnique.mockResolvedValue({ id: cityId });
    prisma.businessCategory.findFirst.mockResolvedValue({ id: categoryId });
    prisma.destination.findFirst.mockResolvedValue(null);
    const service = new BusinessesService(prisma as PrismaService);

    await expect(
      service.create(userId, { ...createDto, destinationId: businessId }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('allows an active manager but rejects staff and inactive members from profile mutation', async () => {
    const managerPrisma = prismaMock();
    managerPrisma.businessMember.findFirst.mockResolvedValue({
      id: 'manager',
      role: BusinessMemberRole.MANAGER,
      status: BusinessMemberStatus.ACTIVE,
    });
    managerPrisma.business.findUnique.mockResolvedValue({
      id: businessId,
      cityId,
      categoryId,
      destinationId: null,
      slug: 'sodo-sample-hotel',
    });
    managerPrisma.city.findUnique.mockResolvedValue({ id: cityId });
    managerPrisma.businessCategory.findFirst.mockResolvedValue({
      id: categoryId,
    });
    const managerService = new BusinessesService(
      managerPrisma as PrismaService,
    );

    await expect(
      managerService.updateMine(userId, businessId, { name: 'Updated Hotel' }),
    ).resolves.toBeDefined();

    const restrictedPrisma = prismaMock();
    restrictedPrisma.businessMember.findFirst.mockResolvedValue(null);
    const restrictedService = new BusinessesService(
      restrictedPrisma as PrismaService,
    );

    await expect(
      restrictedService.updateMine(userId, businessId, {
        name: 'Blocked update',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      restrictedService.findMineById(userId, businessId),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
