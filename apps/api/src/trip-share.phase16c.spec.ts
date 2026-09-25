import {
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { TripItemType, TripStatus, UserStatus } from '@prisma/client';
import { createSecureToken, hashToken } from './auth/token.util';
import { TripShareRateLimiterService } from './trips/trip-share-rate-limiter.service';
import { TripShareService } from './trips/trip-share.service';

const userId = '11111111-1111-4111-8111-111111111111';
const otherUserId = '22222222-2222-4222-8222-822222222222';
const tripId = '33333333-3333-4333-8333-333333333333';

type AsyncMock<TResult, TArgs extends unknown[] = [unknown]> = jest.Mock<
  Promise<TResult>,
  TArgs
>;

type TripShareCreateInput = {
  data: { expiresAt: Date | null; tokenHash: string; tripId: string };
};

type TripItemFindManyInput = {
  where: { type: { in: TripItemType[] } };
  take: number;
};

function ownerTrip(status: TripStatus = TripStatus.DRAFT) {
  return {
    id: tripId,
    status,
    archivedAt: status === TripStatus.ARCHIVED ? new Date() : null,
  };
}

function publicTrip() {
  return {
    ...ownerTrip(),
    title: 'Wolaita discovery',
    startDate: new Date('2030-06-10T00:00:00.000Z'),
    endDate: new Date('2030-06-12T00:00:00.000Z'),
    primaryDestinationId: null,
  };
}

function setup(options: { status?: TripStatus; share?: object | null } = {}) {
  const trip = ownerTrip(options.status);
  const tripShareCreateMock: AsyncMock<
    { expiresAt: Date | null },
    [TripShareCreateInput]
  > = jest.fn(({ data }) => Promise.resolve({ expiresAt: data.expiresAt }));
  const tripItemFindManyMock: AsyncMock<unknown[], [TripItemFindManyInput]> =
    jest
      .fn<Promise<unknown[]>, [TripItemFindManyInput]>()
      .mockResolvedValue([]);
  const tx = {
    tripShare: {
      create: tripShareCreateMock,
      findUnique: jest.fn().mockResolvedValue(options.share ?? null),
      update: jest.fn(),
    },
  };
  const prisma = {
    user: {
      findFirst: jest
        .fn()
        .mockResolvedValue({ id: userId, status: UserStatus.ACTIVE }),
    },
    trip: { findFirst: jest.fn().mockResolvedValue(trip) },
    tripShare: {
      findFirst: jest.fn(),
      findUnique: jest.fn().mockResolvedValue(options.share ?? null),
      update: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    tripDay: { findMany: jest.fn().mockResolvedValue([]) },
    tripItem: { findMany: tripItemFindManyMock },
    destination: {
      findFirst: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
    },
    attraction: { findMany: jest.fn().mockResolvedValue([]) },
    business: { findMany: jest.fn().mockResolvedValue([]) },
    service: { findMany: jest.fn().mockResolvedValue([]) },
    $transaction: jest.fn((callback: (client: typeof tx) => Promise<unknown>) =>
      callback(tx),
    ),
  };
  const limiter = { consume: jest.fn().mockResolvedValue(undefined) };
  return {
    prisma,
    tx,
    tripShareCreateMock,
    tripItemFindManyMock,
    limiter,
    service: new TripShareService(prisma as never, limiter as never),
  };
}

describe('Phase 16C trip sharing', () => {
  it('uses a 48-byte secret and persists only its SHA-256 hash', async () => {
    const { service, tripShareCreateMock } = setup();
    const result = await service.create(userId, tripId, {});
    const input = tripShareCreateMock.mock.calls[0]?.[0];
    expect(result.token).toHaveLength(64);
    expect(input?.data.tripId).toBe(tripId);
    expect(input?.data.tokenHash).toBe(hashToken(result.token));
    expect(input?.data.tokenHash).not.toBe(result.token);
  });

  it('does not implicitly replace an existing share record', async () => {
    const { service } = setup({ share: { id: 'share' } });
    await expect(service.create(userId, tripId, {})).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('hides foreign trips and prevents archived trips from being shared', async () => {
    const { service, prisma } = setup();
    prisma.trip.findFirst.mockResolvedValueOnce(null);
    await expect(
      service.findOwnerShare(otherUserId, tripId),
    ).rejects.toBeInstanceOf(NotFoundException);

    const archived = setup({ status: TripStatus.ARCHIVED });
    await expect(
      archived.service.create(userId, tripId, {}),
    ).rejects.toBeInstanceOf(ConflictException);
    await archived.service.revoke(userId, tripId);
    expect(archived.prisma.tripShare.updateMany).toHaveBeenCalled();
  });

  it('rejects past expiry and refuses to reactivate expired links with PATCH', async () => {
    const { service } = setup({
      share: {
        expiresAt: new Date('2000-01-01T00:00:00.000Z'),
        revokedAt: null,
      },
    });
    await expect(
      service.create(userId, tripId, { expiresAt: '2000-01-01T00:00:00.000Z' }),
    ).rejects.toThrow('Share expiration must be in the future.');
    await expect(
      service.updateExpiration(userId, tripId, {
        expiresAt: '2031-01-01T00:00:00.000Z',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('returns a privacy-safe public projection and excludes booking/custom items', async () => {
    const { service, prisma, limiter, tripItemFindManyMock } = setup();
    prisma.tripShare.findFirst.mockResolvedValue({ trip: publicTrip() });
    prisma.tripDay.findMany.mockResolvedValue([
      {
        id: '44444444-4444-4444-8444-444444444444',
        date: new Date('2030-06-10T00:00:00.000Z'),
        dayNumber: 1,
      },
    ]);
    prisma.tripItem.findMany.mockResolvedValue([
      {
        tripDayId: '44444444-4444-4444-8444-444444444444',
        type: TripItemType.BUSINESS,
        destinationId: null,
        attractionId: null,
        businessId: '55555555-5555-4555-8555-555555555555',
        serviceId: null,
        startTime: '09:00',
        endTime: '10:00',
        position: 0,
      },
    ]);
    prisma.business.findMany.mockResolvedValue([
      { id: '55555555-5555-4555-8555-555555555555', name: 'Public lodge' },
    ]);

    const result = await service.resolve(createSecureToken(48), '127.0.0.1');
    expect(limiter.consume).toHaveBeenCalledWith(
      expect.any(String),
      '127.0.0.1',
    );
    expect(result).toEqual({
      title: 'Wolaita discovery',
      startDate: '2030-06-10',
      endDate: '2030-06-12',
      destinations: [],
      days: [
        {
          date: '2030-06-10',
          dayNumber: 1,
          items: [
            {
              type: TripItemType.BUSINESS,
              title: 'Public lodge',
              startTime: '09:00',
              endTime: '10:00',
            },
          ],
        },
      ],
      truncated: false,
    });
    expect(JSON.stringify(result)).not.toMatch(
      /notes|budget|booking|payment|token|userId|tripDayId/,
    );
    const query = tripItemFindManyMock.mock.calls[0]?.[0];
    expect(query?.take).toBe(201);
    expect(query?.where.type.in).not.toContain(TripItemType.BOOKING);
    expect(query?.where.type.in).not.toContain(TripItemType.CUSTOM);
  });

  it('returns a generic not-found result for invalid, revoked, expired, or archived tokens', async () => {
    const { service, prisma } = setup();
    prisma.tripShare.findFirst.mockResolvedValue(null);
    await expect(
      service.resolve(createSecureToken(48), '127.0.0.1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('TripShareRateLimiterService', () => {
  it('fails closed in production when distributed Redis limiting is unavailable', async () => {
    const config = {
      get: jest.fn().mockReturnValue('production'),
    };
    const redis = { incrementWithExpiry: jest.fn().mockResolvedValue(null) };
    const limiter = new TripShareRateLimiterService(
      config as never,
      redis as never,
    );
    await expect(limiter.consume('hash', '127.0.0.1')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
