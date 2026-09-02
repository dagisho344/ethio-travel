/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument */
import { ConflictException, NotFoundException } from '@nestjs/common';
import { ReviewStatus, UserStatus } from '@prisma/client';
import { AdminReviewSort } from './reviews/dto/review-query.dto';
import { ReviewTargetType } from './reviews/dto/review-target-type.enum';
import { ReviewsService } from './reviews/reviews.service';

const adminId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const reviewId = '22222222-2222-4222-8222-222222222222';

function adminRecord(status: ReviewStatus = ReviewStatus.PENDING) {
  return {
    id: reviewId,
    userId: '11111111-1111-4111-8111-111111111111',
    rating: 5,
    title: 'Great',
    body: 'Helpful visit.',
    status,
    moderationNote:
      status === ReviewStatus.REJECTED ? 'Not enough detail.' : null,
    moderatedAt:
      status === ReviewStatus.PENDING
        ? null
        : new Date('2026-01-02T00:00:00.000Z'),
    moderatedById: status === ReviewStatus.PENDING ? null : adminId,
    publishedAt:
      status === ReviewStatus.PUBLISHED
        ? new Date('2026-01-02T00:00:00.000Z')
        : null,
    hiddenAt:
      status === ReviewStatus.HIDDEN
        ? new Date('2026-01-03T00:00:00.000Z')
        : null,
    rejectedAt:
      status === ReviewStatus.REJECTED
        ? new Date('2026-01-03T00:00:00.000Z')
        : null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    author: {
      id: '11111111-1111-4111-8111-111111111111',
      email: 'traveler@example.com',
      status: UserStatus.ACTIVE,
      profile: { firstName: 'Dagi', lastName: 'Traveler' },
    },
    business: {
      id: '33333333-3333-4333-8333-333333333333',
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
    service: null,
    destination: null,
    attraction: null,
  };
}

function prismaMock(updateCount = 1): any {
  const prisma: any = {
    review: {
      count: jest.fn(() => Promise.resolve(1)),
      findMany: jest.fn(() => Promise.resolve([adminRecord()])),
      findUnique: jest.fn(() => Promise.resolve(adminRecord())),
      update: jest.fn(() => Promise.resolve({ id: reviewId })),
      updateMany: jest.fn(() => Promise.resolve({ count: updateCount })),
    },
  };
  prisma.$transaction = jest.fn((arg: any) =>
    Array.isArray(arg) ? Promise.all(arg) : arg(prisma),
  );
  return prisma;
}

describe('ReviewsService admin moderation', () => {
  it('lists the moderation queue with filters and safe author context', async () => {
    const prisma = prismaMock();
    const result = await new ReviewsService(prisma).findAdmin({
      page: 1,
      limit: 20,
      status: ReviewStatus.PENDING,
      targetType: ReviewTargetType.BUSINESS,
      rating: 5,
      userId: '11111111-1111-4111-8111-111111111111',
      sort: AdminReviewSort.OLDEST,
    });

    expect(prisma.review.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: ReviewStatus.PENDING,
          businessId: { not: null },
          rating: 5,
          userId: '11111111-1111-4111-8111-111111111111',
        }),
        orderBy: [{ createdAt: 'asc' }],
      }),
    );
    expect(result.data[0]!.author).toEqual({
      id: '11111111-1111-4111-8111-111111111111',
      email: 'traveler@example.com',
      status: UserStatus.ACTIVE,
      displayName: 'Dagi Traveler',
    });
  });

  it('returns admin review detail or 404 when missing', async () => {
    const prisma = prismaMock();
    await expect(
      new ReviewsService(prisma).findAdminById(reviewId),
    ).resolves.toMatchObject({ id: reviewId });
    prisma.review.findUnique.mockResolvedValueOnce(null);
    await expect(
      new ReviewsService(prisma).findAdminById(reviewId),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('publishes a pending review and clears stale hide/reject fields', async () => {
    const prisma = prismaMock();
    await new ReviewsService(prisma).publish(reviewId, adminId);
    expect(prisma.review.updateMany).toHaveBeenCalledWith({
      where: { id: reviewId, status: ReviewStatus.PENDING },
      data: expect.objectContaining({
        status: ReviewStatus.PUBLISHED,
        moderationNote: null,
        hiddenAt: null,
        rejectedAt: null,
      }),
    });
    expect(prisma.review.update).toHaveBeenCalledWith({
      where: { id: reviewId },
      data: { moderator: { connect: { id: adminId } } },
      select: { id: true },
    });
  });

  it('rejects a pending review with a required reason', async () => {
    const prisma = prismaMock();
    await new ReviewsService(prisma).reject(
      reviewId,
      adminId,
      '  Not useful  ',
    );
    expect(prisma.review.updateMany).toHaveBeenCalledWith({
      where: { id: reviewId, status: ReviewStatus.PENDING },
      data: expect.objectContaining({
        status: ReviewStatus.REJECTED,
        moderationNote: 'Not useful',
        publishedAt: null,
        hiddenAt: null,
      }),
    });
  });

  it('hides only a published review with a required reason', async () => {
    const prisma = prismaMock();
    await new ReviewsService(prisma).hide(
      reviewId,
      adminId,
      '  Policy issue  ',
    );
    expect(prisma.review.updateMany).toHaveBeenCalledWith({
      where: { id: reviewId, status: ReviewStatus.PUBLISHED },
      data: expect.objectContaining({
        status: ReviewStatus.HIDDEN,
        moderationNote: 'Policy issue',
        publishedAt: null,
        rejectedAt: null,
      }),
    });
  });

  it('returns conflict for invalid moderation transitions', async () => {
    const prisma = prismaMock(0);
    await expect(
      new ReviewsService(prisma).publish(reviewId, adminId),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('returns not found for missing moderation target', async () => {
    const prisma = prismaMock(0);
    prisma.review.findUnique.mockResolvedValueOnce(null);
    await expect(
      new ReviewsService(prisma).reject(reviewId, adminId, 'Reason'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
