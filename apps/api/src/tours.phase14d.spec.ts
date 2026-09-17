import {
  BusinessMemberRole,
  BusinessMemberStatus,
  ServiceCategoryFamily,
  ServiceStatus,
} from '@prisma/client';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { BusinessesService } from './businesses/businesses.service';
import { PrismaService } from './prisma/prisma.service';
import { MAX_TOUR_ITINERARY_ITEMS } from './tours/tour.constants';
import { ToursService } from './tours/tours.service';

const userId = '11111111-1111-4111-8111-111111111111';
const businessId = '22222222-2222-4222-8222-222222222222';
const serviceId = '33333333-3333-4333-8333-333333333333';
const detailId = '44444444-4444-4444-8444-444444444444';
const itemId = '55555555-5555-4555-8555-555555555555';
const createdAt = new Date('2026-09-18T10:00:00.000Z');

function itineraryRecord() {
  return {
    id: itemId,
    dayNumber: 1,
    title: 'Arrive in Sodo',
    description: 'Meet the local guide.',
    sortOrder: 0,
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
  durationDays?: number | null;
}) {
  return {
    id: serviceId,
    name: 'Wolaita Highlands Tour',
    status: options?.status ?? ServiceStatus.DRAFT,
    category: {
      code: options?.categoryCode ?? 'TOUR',
      family: options?.categoryFamily ?? ServiceCategoryFamily.TOUR,
      name: options?.categoryName ?? 'Tour',
    },
    tourDetail:
      options?.detail === false
        ? null
        : {
            id: detailId,
            durationDays: options?.durationDays ?? 3,
            difficulty: 'Moderate',
            meetingPoint: 'Sodo bus station',
            inclusions: ['Guide'],
            exclusions: ['Lunch'],
            itineraryItems: [itineraryRecord()],
          },
  };
}

function fixture(record = serviceRecord()) {
  const requireMembership = jest
    .fn()
    .mockResolvedValue({ role: BusinessMemberRole.OWNER });
  const userFindFirst = jest.fn().mockResolvedValue({ id: userId });
  const serviceFindFirst = jest.fn().mockResolvedValue(record);
  const detailUpsert = jest.fn().mockResolvedValue({});
  const itineraryCount = jest.fn().mockResolvedValue(0);
  const itineraryCreate = jest.fn().mockResolvedValue(itineraryRecord());
  const itineraryUpdate = jest.fn().mockResolvedValue(itineraryRecord());
  const itineraryFindFirst = jest
    .fn()
    .mockImplementation((args: { where: { id?: string } }) =>
      Promise.resolve(args.where.id ? { id: itemId, dayNumber: 1 } : null),
    );
  const prisma = {
    user: { findFirst: userFindFirst },
    service: { findFirst: serviceFindFirst },
    tourDetail: { upsert: detailUpsert },
    tourItineraryItem: {
      count: itineraryCount,
      create: itineraryCreate,
      update: itineraryUpdate,
      findFirst: itineraryFindFirst,
    },
  } as unknown as PrismaService;
  const businesses = { requireMembership } as unknown as BusinessesService;
  return {
    prisma,
    tours: new ToursService(prisma, businesses),
    requireMembership,
    userFindFirst,
    serviceFindFirst,
    detailUpsert,
    itineraryCount,
    itineraryCreate,
    itineraryUpdate,
    itineraryFindFirst,
  };
}

describe('Phase 14D tour service', () => {
  it('allows active staff to read an owned TOUR-family service', async () => {
    const { tours, requireMembership } = fixture();
    requireMembership.mockResolvedValue({ role: BusinessMemberRole.STAFF });

    await expect(
      tours.findMine(userId, businessId, serviceId),
    ).resolves.toMatchObject({
      service: { id: serviceId, category: { code: 'TOUR' } },
      detail: { durationDays: 3 },
      itinerary: [{ id: itemId }],
    });
    expect(requireMembership).toHaveBeenCalledWith(userId, businessId, [
      BusinessMemberRole.OWNER,
      BusinessMemberRole.MANAGER,
      BusinessMemberRole.STAFF,
    ]);
  });

  it('permits future TOUR-family category codes without using display names', async () => {
    const { tours } = fixture(
      serviceRecord({
        categoryCode: 'TOUR_SPECIAL',
        categoryFamily: ServiceCategoryFamily.TOUR,
        categoryName: 'Not used for compatibility',
      }),
    );

    await expect(
      tours.findMine(userId, businessId, serviceId),
    ).resolves.toMatchObject({
      service: { category: { code: 'TOUR_SPECIAL' } },
    });
  });

  it.each([
    ['ROOM', ServiceCategoryFamily.ACCOMMODATION],
    ['MEAL', ServiceCategoryFamily.RESTAURANT],
    ['TRANSFER', ServiceCategoryFamily.TRANSPORT],
    ['GENERAL', ServiceCategoryFamily.OTHER],
  ])('rejects %s outside the TOUR family', async (code, family) => {
    const { tours, detailUpsert } = fixture(
      serviceRecord({ categoryCode: code, categoryFamily: family }),
    );

    await expect(
      tours.updateDetail(userId, businessId, serviceId, { durationDays: 3 }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(detailUpsert).not.toHaveBeenCalled();
  });

  it('allows an active manager to update details and normalizes typed inclusion labels', async () => {
    const { tours, requireMembership, detailUpsert } = fixture();
    requireMembership.mockResolvedValue({ role: BusinessMemberRole.MANAGER });

    await tours.updateDetail(userId, businessId, serviceId, {
      durationDays: 3,
      inclusions: [' Guide ', 'guide', 'Transport '],
      exclusions: ['Lunch'],
    });

    expect(requireMembership).toHaveBeenCalledWith(userId, businessId, [
      BusinessMemberRole.OWNER,
      BusinessMemberRole.MANAGER,
    ]);
    expect(detailUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          inclusions: ['Guide', 'Transport'],
          exclusions: ['Lunch'],
        }),
      }),
    );
  });

  it('requires details before creating itinerary and preserves itinerary rows through updates', async () => {
    const withoutDetail = fixture(serviceRecord({ detail: false }));
    await expect(
      withoutDetail.tours.createItineraryItem(userId, businessId, serviceId, {
        dayNumber: 1,
        title: 'Arrival',
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    const withDetail = fixture();
    const updated = await withDetail.tours.updateItineraryItem(
      userId,
      businessId,
      serviceId,
      itemId,
      { title: 'Updated arrival' },
    );
    expect(updated).toMatchObject({ id: itemId });
    expect(withDetail.itineraryUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: itemId },
        data: { title: 'Updated arrival' },
      }),
    );
  });

  it('enforces duration against existing and newly created itinerary days', async () => {
    const current = fixture();
    current.itineraryFindFirst.mockImplementation(
      (args: { where: { id?: string } }) =>
        Promise.resolve(
          args.where.id ? { id: itemId, dayNumber: 3 } : { dayNumber: 4 },
        ),
    );

    await expect(
      current.tours.updateDetail(userId, businessId, serviceId, {
        durationDays: 3,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      current.tours.createItineraryItem(userId, businessId, serviceId, {
        dayNumber: 4,
        title: 'Beyond duration',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(current.detailUpsert).not.toHaveBeenCalled();
    expect(current.itineraryCreate).not.toHaveBeenCalled();
  });

  it('denies inactive users and inactive memberships before Tour mutations', async () => {
    const inactiveUser = fixture();
    inactiveUser.userFindFirst.mockResolvedValue(null);
    await expect(
      inactiveUser.tours.updateDetail(userId, businessId, serviceId, {
        durationDays: 3,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(inactiveUser.requireMembership).not.toHaveBeenCalled();

    const activeFixture = fixture();
    const memberships = {
      businessMember: { findFirst: jest.fn().mockResolvedValue(null) },
    } as unknown as PrismaService;
    const tours = new ToursService(
      activeFixture.prisma,
      new BusinessesService(memberships),
    );
    await expect(
      tours.createItineraryItem(userId, businessId, serviceId, {
        dayNumber: 1,
        title: 'Arrival',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(memberships.businessMember.findFirst).toHaveBeenCalledWith({
      where: {
        businessId,
        userId,
        status: BusinessMemberStatus.ACTIVE,
        role: {
          in: [BusinessMemberRole.OWNER, BusinessMemberRole.MANAGER],
        },
      },
    });
  });

  it('denies STAFF, non-members, and cross-business service or itinerary UUIDs', async () => {
    const staff = fixture();
    staff.requireMembership.mockImplementation(
      (_userId: string, _businessId: string, roles: BusinessMemberRole[]) =>
        roles.includes(BusinessMemberRole.STAFF)
          ? Promise.resolve({ role: BusinessMemberRole.STAFF })
          : Promise.reject(new ForbiddenException()),
    );
    await expect(
      staff.tours.updateDetail(userId, businessId, serviceId, {
        durationDays: 3,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      staff.tours.createItineraryItem(userId, businessId, serviceId, {
        dayNumber: 1,
        title: 'Arrival',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    const otherBusiness = fixture();
    otherBusiness.serviceFindFirst.mockResolvedValue(null);
    await expect(
      otherBusiness.tours.updateDetail(userId, businessId, serviceId, {
        durationDays: 3,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    const crossItem = fixture();
    crossItem.itineraryFindFirst.mockResolvedValue(null);
    await expect(
      crossItem.tours.updateItineraryItem(
        userId,
        businessId,
        serviceId,
        itemId,
        { title: 'Changed' },
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(crossItem.itineraryUpdate).not.toHaveBeenCalled();
  });

  it('enforces the bounded itinerary application limit across all retained rows', async () => {
    const belowLimit = fixture();
    belowLimit.itineraryCount.mockResolvedValue(MAX_TOUR_ITINERARY_ITEMS - 1);
    await expect(
      belowLimit.tours.createItineraryItem(userId, businessId, serviceId, {
        dayNumber: 1,
        title: 'Arrival',
      }),
    ).resolves.toMatchObject({ id: itemId });

    const atLimit = fixture();
    atLimit.itineraryCount.mockResolvedValue(MAX_TOUR_ITINERARY_ITEMS);
    await expect(
      atLimit.tours.createItineraryItem(userId, businessId, serviceId, {
        dayNumber: 1,
        title: 'Arrival',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(atLimit.itineraryCreate).not.toHaveBeenCalled();
    expect(atLimit.itineraryCount).toHaveBeenCalledWith({
      where: { tourDetailId: detailId },
    });
  });

  it('does not mutate Tour content for archived services', async () => {
    const { tours } = fixture(
      serviceRecord({ status: ServiceStatus.ARCHIVED }),
    );
    await expect(
      tours.updateDetail(userId, businessId, serviceId, { durationDays: 3 }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
