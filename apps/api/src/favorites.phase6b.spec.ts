/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument */
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { FavoriteTargetType } from './favorites/dto/favorite-target-type.enum';
import { FavoritesService } from './favorites/favorites.service';

const userId = '11111111-1111-4111-8111-111111111111';
const otherUserId = '99999999-9999-4999-8999-999999999999';
const favoriteId = '22222222-2222-4222-8222-222222222222';
const targetId = '33333333-3333-4333-8333-333333333333';

function delegate() {
  return {
    count: jest.fn(() => Promise.resolve(1)),
    create: jest.fn(() => Promise.resolve({ id: favoriteId })),
    deleteMany: jest.fn(() => Promise.resolve({ count: 1 })),
    findFirst: jest.fn(() => Promise.resolve({ id: targetId })),
    findMany: jest.fn(() => Promise.resolve([favoriteRecord('BUSINESS')])),
  };
}

function prismaMock(): any {
  const prisma: any = {
    attraction: delegate(),
    business: delegate(),
    destination: delegate(),
    favorite: delegate(),
    service: delegate(),
    user: delegate(),
  };
  prisma.$transaction = jest.fn((arg: any) =>
    Array.isArray(arg) ? Promise.all(arg) : arg(prisma),
  );
  prisma.favorite.findFirst.mockResolvedValue(favoriteRecord('BUSINESS'));
  return prisma;
}

function service(prisma: any) {
  return new FavoritesService(prisma);
}

function favoriteRecord(type: keyof typeof FavoriteTargetType) {
  const base = {
    id: favoriteId,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    business: null,
    service: null,
    destination: null,
    attraction: null,
  };

  if (type === 'BUSINESS') {
    return {
      ...base,
      business: {
        id: targetId,
        name: 'Public Business',
        slug: 'public-business',
        description: 'Visible business description',
        category: { code: 'HOTEL', name: 'Hotel' },
        city: {
          name: 'Bole',
          slug: 'bole',
          region: { name: 'Addis Ababa', slug: 'addis-ababa' },
        },
        destination: null,
      },
    };
  }

  if (type === 'SERVICE') {
    return {
      ...base,
      service: {
        id: targetId,
        name: 'Public Service',
        slug: 'public-service',
        shortDescription: 'Visible service',
        pricingModel: 'FIXED',
        price: new Prisma.Decimal(10),
        currency: 'ETB',
        category: { code: 'ROOM', name: 'Room' },
        business: {
          name: 'Public Business',
          slug: 'public-business',
          city: {
            name: 'Bole',
            slug: 'bole',
            region: { name: 'Addis Ababa', slug: 'addis-ababa' },
          },
          destination: null,
        },
      },
    };
  }

  if (type === 'DESTINATION') {
    return {
      ...base,
      destination: {
        id: targetId,
        name: 'Public Destination',
        slug: 'public-destination',
        shortDescription: 'Visible destination',
        city: {
          name: 'Bole',
          slug: 'bole',
          region: { name: 'Addis Ababa', slug: 'addis-ababa' },
        },
      },
    };
  }

  return {
    ...base,
    attraction: {
      id: targetId,
      name: 'Public Attraction',
      slug: 'public-attraction',
      category: 'LANDMARK',
      description: 'Visible attraction',
      destination: {
        name: 'Public Destination',
        slug: 'public-destination',
        city: {
          name: 'Bole',
          slug: 'bole',
          region: { name: 'Addis Ababa', slug: 'addis-ababa' },
        },
      },
    },
  };
}

describe('FavoritesService', () => {
  it.each([
    [FavoriteTargetType.BUSINESS, 'business', 'businessId'],
    [FavoriteTargetType.SERVICE, 'service', 'serviceId'],
    [FavoriteTargetType.DESTINATION, 'destination', 'destinationId'],
    [FavoriteTargetType.ATTRACTION, 'attraction', 'attractionId'],
  ] as const)(
    'creates a favorite for public %s targets',
    async (targetType, delegateName, foreignKey) => {
      const prisma = prismaMock();
      prisma.favorite.findFirst.mockResolvedValue(favoriteRecord(targetType));

      const result = await service(prisma).create(userId, {
        targetType,
        targetId,
      });

      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: { id: userId, status: 'ACTIVE' },
        select: { id: true },
      });
      expect(prisma[delegateName].findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: targetId }),
          select: { id: true },
        }),
      );
      expect(prisma.favorite.create).toHaveBeenCalledWith({
        data: { userId, [foreignKey]: targetId },
        select: { id: true },
      });
      expect(result.target.type).toBe(targetType);
    },
  );

  it('rejects nonexistent or non-public targets', async () => {
    const prisma = prismaMock();
    prisma.business.findFirst.mockResolvedValue(null);

    await expect(
      service(prisma).create(userId, {
        targetType: FavoriteTargetType.BUSINESS,
        targetId,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('maps duplicate favorite races to conflict', async () => {
    const prisma = prismaMock();
    prisma.favorite.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Duplicate favorite', {
        clientVersion: 'test',
        code: 'P2002',
      }),
    );

    await expect(
      service(prisma).create(userId, {
        targetType: FavoriteTargetType.BUSINESS,
        targetId,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('uses database uniqueness for concurrent duplicate protection', async () => {
    const prisma = prismaMock();
    prisma.favorite.create
      .mockResolvedValueOnce({ id: favoriteId })
      .mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError('Duplicate favorite', {
          clientVersion: 'test',
          code: 'P2002',
        }),
      );

    const [first, second] = await Promise.allSettled([
      service(prisma).create(userId, {
        targetType: FavoriteTargetType.BUSINESS,
        targetId,
      }),
      service(prisma).create(userId, {
        targetType: FavoriteTargetType.BUSINESS,
        targetId,
      }),
    ]);

    expect(first.status).toBe('fulfilled');
    expect(second.status).toBe('rejected');
    if (second.status === 'rejected') {
      expect(second.reason).toBeInstanceOf(ConflictException);
    }
  });

  it('lists only visible favorites for the authenticated user', async () => {
    const prisma = prismaMock();

    const result = await service(prisma).findMine(userId, {
      page: 2,
      limit: 5,
    });

    expect(prisma.favorite.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId }),
        skip: 5,
        take: 5,
      }),
    );
    expect(result.meta).toEqual({ page: 2, limit: 5, total: 1, totalPages: 1 });
    expect(result.data[0]!.target).not.toHaveProperty('adminNotes');
    expect(result.data[0]!.target).not.toHaveProperty('members');
  });

  it('filters favorites by target type', async () => {
    const prisma = prismaMock();

    await service(prisma).findMine(userId, {
      page: 1,
      limit: 20,
      targetType: FavoriteTargetType.SERVICE,
    });

    expect(prisma.favorite.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId,
          serviceId: { not: null },
        }),
      }),
    );
  });

  it('deletes only an owned favorite without leaking ownership', async () => {
    const prisma = prismaMock();

    await service(prisma).remove(userId, favoriteId);

    expect(prisma.favorite.deleteMany).toHaveBeenCalledWith({
      where: { id: favoriteId, userId },
    });
  });

  it('returns not found when deleting another user favorite', async () => {
    const prisma = prismaMock();
    prisma.favorite.deleteMany.mockResolvedValue({ count: 0 });

    await expect(
      service(prisma).remove(otherUserId, favoriteId),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('allows a deleted favorite target to be created again', async () => {
    const prisma = prismaMock();

    await service(prisma).remove(userId, favoriteId);
    await service(prisma).create(userId, {
      targetType: FavoriteTargetType.BUSINESS,
      targetId,
    });

    expect(prisma.favorite.deleteMany).toHaveBeenCalledTimes(1);
    expect(prisma.favorite.create).toHaveBeenCalledTimes(1);
  });
});
