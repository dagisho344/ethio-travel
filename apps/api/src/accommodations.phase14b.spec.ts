import {
  BusinessMemberRole,
  Prisma,
  ServiceCategoryFamily,
  ServiceStatus,
} from '@prisma/client';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { AccommodationService } from './accommodations/accommodations.service';
import { BusinessesService } from './businesses/businesses.service';
import { PrismaService } from './prisma/prisma.service';

const userId = '11111111-1111-4111-8111-111111111111';
const businessId = '22222222-2222-4222-8222-222222222222';
const serviceId = '33333333-3333-4333-8333-333333333333';
const roomTypeId = '44444444-4444-4444-8444-444444444444';
const createdAt = new Date('2026-09-16T10:00:00.000Z');

function roomRecord() {
  return {
    id: roomTypeId,
    name: 'Deluxe King',
    description: 'A quiet room with a king bed.',
    capacity: 2,
    basePrice: new Prisma.Decimal('1250.00'),
    currency: 'ETB',
    quantity: 4,
    isActive: true,
    createdAt,
    updatedAt: createdAt,
  };
}

function serviceRecord(options?: {
  categoryCode?: string;
  categoryFamily?: ServiceCategoryFamily;
  categoryName?: string;
  detail?: boolean;
  status?: ServiceStatus;
}) {
  return {
    id: serviceId,
    name: 'Deluxe room',
    status: options?.status ?? ServiceStatus.DRAFT,
    category: {
      code: options?.categoryCode ?? 'ROOM',
      family: options?.categoryFamily ?? ServiceCategoryFamily.ACCOMMODATION,
      name: options?.categoryName ?? 'Room',
    },
    accommodationDetail:
      options?.detail === false
        ? null
        : {
            id: '55555555-5555-4555-8555-555555555555',
            starClass: 4,
            checkInTime: '14:00',
            checkOutTime: '11:00',
            roomTypes: [roomRecord()],
          },
  };
}

function fixture(record = serviceRecord()) {
  const requireMembership = jest
    .fn()
    .mockResolvedValue({ role: BusinessMemberRole.OWNER });
  const roomTypeFindFirst = jest.fn().mockResolvedValue({ id: roomTypeId });
  const detailUpsert = jest
    .fn<Promise<unknown>, [unknown]>()
    .mockResolvedValue({});
  const roomTypeCreate = jest
    .fn<Promise<unknown>, [unknown]>()
    .mockResolvedValue(roomRecord());
  const roomTypeUpdate = jest.fn().mockResolvedValue(roomRecord());
  const prisma = {
    user: { findFirst: jest.fn().mockResolvedValue({ id: userId }) },
    service: { findFirst: jest.fn().mockResolvedValue(record) },
    accommodationDetail: { upsert: detailUpsert },
    roomType: {
      create: roomTypeCreate,
      findFirst: roomTypeFindFirst,
      update: roomTypeUpdate,
    },
  } as unknown as PrismaService;
  const businesses = {
    requireMembership,
  } as unknown as BusinessesService;
  return {
    accommodation: new AccommodationService(prisma, businesses),
    requireMembership,
    detailUpsert,
    roomTypeCreate,
    roomTypeUpdate,
    roomTypeFindFirst,
  };
}

describe('Phase 14B accommodation service', () => {
  it('allows active staff to read an owned ROOM service while preserving room inventory fields for the workspace', async () => {
    const { accommodation, requireMembership } = fixture();
    requireMembership.mockResolvedValue({ role: BusinessMemberRole.STAFF });

    await expect(
      accommodation.findMine(userId, businessId, serviceId),
    ).resolves.toMatchObject({
      service: { id: serviceId, category: { code: 'ROOM' } },
      detail: { starClass: 4, checkInTime: '14:00' },
      roomTypes: [
        expect.objectContaining({
          id: roomTypeId,
          basePrice: '1250',
          quantity: 4,
          isActive: true,
        }),
      ],
    });
    expect(requireMembership).toHaveBeenCalledWith(userId, businessId, [
      BusinessMemberRole.OWNER,
      BusinessMemberRole.MANAGER,
      BusinessMemberRole.STAFF,
    ]);
  });

  it('requires owner or manager membership for accommodation and room mutations', async () => {
    const { accommodation, detailUpsert, requireMembership, roomTypeCreate } =
      fixture();

    await accommodation.updateDetail(userId, businessId, serviceId, {
      starClass: 5,
      checkInTime: '15:00',
    });
    await accommodation.createRoom(userId, businessId, serviceId, {
      name: 'Family room',
      capacity: 4,
      basePrice: '2000.00',
      currency: 'ETB',
      quantity: 2,
    });

    expect(requireMembership).toHaveBeenCalledWith(userId, businessId, [
      BusinessMemberRole.OWNER,
      BusinessMemberRole.MANAGER,
    ]);
    expect(detailUpsert.mock.calls[0]?.[0]).toMatchObject({
      where: { serviceId },
      update: { starClass: 5, checkInTime: '15:00' },
    });
    expect(roomTypeCreate.mock.calls[0]?.[0]).toMatchObject({
      data: { capacity: 4, currency: 'ETB', quantity: 2 },
    });
  });

  it('honors the membership service denial before a staff or unrelated user can write', async () => {
    const { accommodation, detailUpsert, requireMembership } = fixture();
    requireMembership.mockRejectedValue(
      new ForbiddenException('Business membership is required.'),
    );

    await expect(
      accommodation.updateDetail(userId, businessId, serviceId, {
        starClass: 3,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(detailUpsert).not.toHaveBeenCalled();
  });

  it('rejects non-accommodation families before any accommodation writes', async () => {
    const { accommodation, detailUpsert } = fixture(
      serviceRecord({
        categoryCode: 'MEAL',
        categoryFamily: ServiceCategoryFamily.RESTAURANT,
      }),
    );

    await expect(
      accommodation.updateDetail(userId, businessId, serviceId, {
        starClass: 3,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(detailUpsert).not.toHaveBeenCalled();
  });

  it('requires an accommodation detail before room creation and preserves inactive room history instead of deleting it', async () => {
    const withoutDetail = fixture(serviceRecord({ detail: false }));
    await expect(
      withoutDetail.accommodation.createRoom(userId, businessId, serviceId, {
        name: 'Standard room',
        capacity: 2,
        basePrice: '900.00',
        currency: 'ETB',
        quantity: 3,
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    const withDetail = fixture();
    await withDetail.accommodation.setRoomActive(
      userId,
      businessId,
      serviceId,
      roomTypeId,
      false,
    );
    expect(withDetail.roomTypeUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { isActive: false } }),
    );
  });

  it('does not allow a room type from another accommodation service to be mutated', async () => {
    const { accommodation, roomTypeFindFirst, roomTypeUpdate } = fixture();
    roomTypeFindFirst.mockResolvedValue(null);

    await expect(
      accommodation.updateRoom(userId, businessId, serviceId, roomTypeId, {
        quantity: 1,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(roomTypeUpdate).not.toHaveBeenCalled();
  });

  it('does not mutate archived service accommodation data', async () => {
    const { accommodation } = fixture(
      serviceRecord({ status: ServiceStatus.ARCHIVED }),
    );

    await expect(
      accommodation.updateDetail(userId, businessId, serviceId, {
        checkOutTime: '10:00',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
  it('accepts a HOTEL code when its stable family is ACCOMMODATION', async () => {
    const { accommodation } = fixture(
      serviceRecord({
        categoryCode: 'HOTEL',
        categoryFamily: ServiceCategoryFamily.ACCOMMODATION,
        categoryName: 'Not used for compatibility',
      }),
    );

    await expect(
      accommodation.findMine(userId, businessId, serviceId),
    ).resolves.toMatchObject({ service: { category: { code: 'HOTEL' } } });
  });

  it.each([
    ['MEAL', ServiceCategoryFamily.RESTAURANT],
    ['TOUR', ServiceCategoryFamily.TOUR],
    ['TRANSFER', ServiceCategoryFamily.TRANSPORT],
    ['GENERAL', ServiceCategoryFamily.OTHER],
  ])('rejects %s outside the ACCOMMODATION family', async (code, family) => {
    const { accommodation, detailUpsert } = fixture(
      serviceRecord({ categoryCode: code, categoryFamily: family }),
    );

    await expect(
      accommodation.updateDetail(userId, businessId, serviceId, {
        starClass: 3,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(detailUpsert).not.toHaveBeenCalled();
  });
});
