/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument */
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ReviewStatus } from '@prisma/client';
import { ReviewTargetType } from './reviews/dto/review-target-type.enum';
import { PublicReviewSort } from './reviews/dto/review-query.dto';
import { ReviewsService } from './reviews/reviews.service';

const userId = '11111111-1111-4111-8111-111111111111';
const otherUserId = '99999999-9999-4999-8999-999999999999';
const reviewId = '22222222-2222-4222-8222-222222222222';
const targetId = '33333333-3333-4333-8333-333333333333';

function delegate() {
  return {
    aggregate: jest.fn(() =>
      Promise.resolve({ _avg: { rating: 4.25 }, _count: { _all: 4 } }),
    ),
    count: jest.fn(() => Promise.resolve(1)),
    create: jest.fn(() => Promise.resolve({ id: reviewId })),
    findFirst: jest.fn(() => Promise.resolve({ id: targetId })),
    findMany: jest.fn(() => Promise.resolve([myReviewRecord('BUSINESS')])),
    groupBy: jest.fn(() =>
      Promise.resolve([
        { rating: 4, _count: 3 },
        { rating: 5, _count: 1 },
      ]),
    ),
    updateMany: jest.fn(() => Promise.resolve({ count: 1 })),
  };
}

function prismaMock(): any {
  const prisma: any = {
    attraction: delegate(),
    business: delegate(),
    destination: delegate(),
    review: delegate(),
    service: delegate(),
    user: delegate(),
  };
  prisma.$transaction = jest.fn((arg: any) =>
    Array.isArray(arg) ? Promise.all(arg) : arg(prisma),
  );
  prisma.review.findFirst.mockResolvedValue(myReviewRecord('BUSINESS'));
  return prisma;
}

function service(prisma: any) {
  return new ReviewsService(prisma);
}

function myReviewRecord(type: keyof typeof ReviewTargetType) {
  const base = {
    id: reviewId,
    rating: 5,
    title: 'Great',
    body: 'Helpful visit.',
    status: ReviewStatus.PENDING,
    moderationNote: 'Please add detail.',
    moderatedAt: new Date('2026-01-02T00:00:00.000Z'),
    publishedAt: null,
    hiddenAt: null,
    rejectedAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    business: null,
    service: null,
    destination: null,
    attraction: null,
  };
  if (type === 'BUSINESS')
    return {
      ...base,
      business: {
        id: targetId,
        name: 'Business',
        slug: 'business',
        category: { code: 'HOTEL', name: 'Hotel' },
        city: {
          name: 'Bole',
          slug: 'bole',
          region: { name: 'Addis Ababa', slug: 'addis-ababa' },
        },
        destination: null,
      },
    };
  if (type === 'SERVICE')
    return {
      ...base,
      service: {
        id: targetId,
        name: 'Service',
        slug: 'service',
        shortDescription: 'Short',
        category: { code: 'ROOM', name: 'Room' },
        business: {
          name: 'Business',
          slug: 'business',
          city: {
            name: 'Bole',
            slug: 'bole',
            region: { name: 'Addis Ababa', slug: 'addis-ababa' },
          },
          destination: null,
        },
      },
    };
  if (type === 'DESTINATION')
    return {
      ...base,
      destination: {
        id: targetId,
        name: 'Destination',
        slug: 'destination',
        shortDescription: 'Short',
        city: {
          name: 'Bole',
          slug: 'bole',
          region: { name: 'Addis Ababa', slug: 'addis-ababa' },
        },
      },
    };
  return {
    ...base,
    attraction: {
      id: targetId,
      name: 'Attraction',
      slug: 'attraction',
      category: 'LANDMARK',
      destination: {
        name: 'Destination',
        slug: 'destination',
        city: {
          name: 'Bole',
          slug: 'bole',
          region: { name: 'Addis Ababa', slug: 'addis-ababa' },
        },
      },
    },
  };
}

function publicReviewRecord() {
  return {
    id: reviewId,
    rating: 4,
    title: 'Nice',
    body: 'Good experience.',
    publishedAt: new Date('2026-01-03T00:00:00.000Z'),
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    author: { profile: { firstName: 'Dagi', lastName: 'Traveler' } },
  };
}

describe('ReviewsService', () => {
  it.each([
    [ReviewTargetType.BUSINESS, 'business', 'businessId'],
    [ReviewTargetType.SERVICE, 'service', 'serviceId'],
    [ReviewTargetType.DESTINATION, 'destination', 'destinationId'],
    [ReviewTargetType.ATTRACTION, 'attraction', 'attractionId'],
  ] as const)(
    'creates pending reviews for %s targets',
    async (targetType, delegateName, foreignKey) => {
      const prisma = prismaMock();
      prisma.review.findFirst.mockResolvedValue(myReviewRecord(targetType));
      const result = await service(prisma).create(userId, {
        targetType,
        targetId,
        rating: 1,
        title: 'Title',
        body: undefined,
      });
      expect(prisma[delegateName].findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: targetId }),
          select: { id: true },
        }),
      );
      expect(prisma.review.create).toHaveBeenCalledWith({
        data: {
          userId,
          [foreignKey]: targetId,
          rating: 1,
          title: 'Title',
          body: undefined,
          status: ReviewStatus.PENDING,
        },
        select: { id: true },
      });
      expect(result.status).toBe(ReviewStatus.PENDING);
    },
  );

  it('accepts rating boundary 5', async () => {
    const prisma = prismaMock();
    await service(prisma).create(userId, {
      targetType: ReviewTargetType.BUSINESS,
      targetId,
      rating: 5,
    });
    expect(prisma.review.create).toHaveBeenCalled();
  });

  it('rejects nonexistent or non-public targets', async () => {
    const prisma = prismaMock();
    prisma.business.findFirst.mockResolvedValue(null);
    await expect(
      service(prisma).create(userId, {
        targetType: ReviewTargetType.BUSINESS,
        targetId,
        rating: 3,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('maps duplicate review races to conflict', async () => {
    const prisma = prismaMock();
    prisma.review.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Duplicate review', {
        clientVersion: 'test',
        code: 'P2002',
      }),
    );
    await expect(
      service(prisma).create(userId, {
        targetType: ReviewTargetType.BUSINESS,
        targetId,
        rating: 3,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('uses database uniqueness for concurrent duplicate protection', async () => {
    const prisma = prismaMock();
    prisma.review.create
      .mockResolvedValueOnce({ id: reviewId })
      .mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError('Duplicate review', {
          clientVersion: 'test',
          code: 'P2002',
        }),
      );
    const [first, second] = await Promise.allSettled([
      service(prisma).create(userId, {
        targetType: ReviewTargetType.BUSINESS,
        targetId,
        rating: 3,
      }),
      service(prisma).create(userId, {
        targetType: ReviewTargetType.BUSINESS,
        targetId,
        rating: 3,
      }),
    ]);
    expect(first.status).toBe('fulfilled');
    expect(second.status).toBe('rejected');
  });

  it('lists own reviews across statuses with filters and moderation note', async () => {
    const prisma = prismaMock();
    const result = await service(prisma).findMine(userId, {
      page: 2,
      limit: 5,
      targetType: ReviewTargetType.BUSINESS,
      status: ReviewStatus.REJECTED,
    });
    expect(prisma.review.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId,
          status: ReviewStatus.REJECTED,
          businessId: { not: null },
        }),
        skip: 5,
        take: 5,
      }),
    );
    expect(result.data[0]!.moderationNote).toBe('Please add detail.');
    expect(result.data[0]!).not.toHaveProperty('moderator');
  });

  it('prevents editing another user review by returning not found', async () => {
    const prisma = prismaMock();
    prisma.review.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      service(prisma).update(otherUserId, reviewId, { rating: 4 }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('requires at least one editable field', async () => {
    await expect(
      service(prismaMock()).update(userId, reviewId, {}),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('resets moderation lifecycle fields when editing', async () => {
    const prisma = prismaMock();
    await service(prisma).update(userId, reviewId, {
      rating: 4,
      title: undefined,
      body: undefined,
    });
    expect(prisma.review.updateMany).toHaveBeenCalledWith({
      where: { id: reviewId, userId },
      data: expect.objectContaining({
        rating: 4,
        status: ReviewStatus.PENDING,
        moderatedAt: null,
        moderatedById: null,
        moderationNote: null,
        publishedAt: null,
        hiddenAt: null,
        rejectedAt: null,
      }),
    });
  });

  it('returns only published public reviews without private author/moderation data', async () => {
    const prisma = prismaMock();
    prisma.review.findMany.mockResolvedValue([publicReviewRecord()]);
    const result = await service(prisma).findPublic({
      targetType: ReviewTargetType.BUSINESS,
      targetId,
      rating: 4,
      sort: PublicReviewSort.HIGHEST,
      page: 1,
      limit: 20,
    });
    expect(prisma.review.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          businessId: targetId,
          status: ReviewStatus.PUBLISHED,
          rating: 4,
        }),
      }),
    );
    expect(result.data[0]!.author.displayName).toBe('Dagi Traveler');
    expect(result.data[0]!).not.toHaveProperty('moderationNote');
    expect(result.data[0]!.author).not.toHaveProperty('email');
  });

  it('calculates summary using database aggregation', async () => {
    const result = await service(prismaMock()).summary({
      targetType: ReviewTargetType.BUSINESS,
      targetId,
    });
    expect(result).toEqual({
      averageRating: 4.3,
      reviewCount: 4,
      ratingDistribution: { '1': 0, '2': 0, '3': 0, '4': 3, '5': 1 },
    });
  });

  it('returns zero summary when no published reviews exist', async () => {
    const prisma = prismaMock();
    prisma.review.aggregate.mockResolvedValue({
      _avg: { rating: null },
      _count: { _all: 0 },
    });
    prisma.review.groupBy.mockResolvedValue([]);
    await expect(
      service(prisma).summary({
        targetType: ReviewTargetType.BUSINESS,
        targetId,
      }),
    ).resolves.toEqual({
      averageRating: null,
      reviewCount: 0,
      ratingDistribution: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 },
    });
  });
});
