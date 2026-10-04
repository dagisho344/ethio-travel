import { ForbiddenException } from '@nestjs/common';
import { BusinessMemberRole, VerificationDocumentType } from '@prisma/client';
import { AccommodationService } from './accommodations/accommodations.service';
import { BookingsService } from './bookings/bookings.service';
import { BusinessLocationsService } from './business-locations/business-locations.service';
import { BusinessMediaService } from './business-media/business-media.service';
import { BusinessMembersService } from './business-members/business-members.service';
import { BusinessOperationsService } from './business-operations/business-operations.service';
import { BusinessVerificationsService } from './business-verifications/business-verifications.service';
import { BusinessesService } from './businesses/businesses.service';
import { ServicesService } from './services/services.service';

const userId = '11111111-1111-4111-8111-111111111111';
const businessId = '22222222-2222-4222-8222-222222222222';
const serviceId = '33333333-3333-4333-8333-333333333333';

describe('Phase 17A-2C business-management mutation coverage', () => {
  const restricted = new ForbiddenException({
    statusCode: 403,
    code: 'USER_CAPABILITY_RESTRICTED',
    capability: 'BUSINESS_MANAGEMENT',
  });

  function setup() {
    const writes = {
      create: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
      putObject: jest.fn(),
    };
    const prisma = {
      user: { findFirst: jest.fn().mockResolvedValue({ id: userId }) },
      service: {
        findUnique: jest.fn().mockResolvedValue({ id: serviceId, businessId }),
        create: writes.create,
        update: writes.update,
      },
      business: { create: writes.create, update: writes.update },
      businessMember: { create: writes.create, update: writes.update },
      businessLocation: { create: writes.create, update: writes.update },
      businessMedia: {
        create: writes.create,
        update: writes.update,
        findUnique: jest.fn().mockResolvedValue(null),
      },
      businessVerification: {
        create: writes.create,
        update: writes.update,
        findFirst: jest.fn().mockResolvedValue({ id: serviceId }),
      },
      reviewResponse: { upsert: writes.upsert },
      serviceBookingConfig: { upsert: writes.upsert },
      accommodationDetail: { upsert: writes.upsert },
      booking: {
        findFirst: jest.fn().mockResolvedValue({ id: serviceId }),
        update: writes.update,
      },
      $transaction: jest.fn(),
    };
    const requireMembership = jest.fn(
      (
        _actor: string,
        _business: string,
        _roles: BusinessMemberRole[],
        intent?: 'read' | 'manage',
      ) => {
        if (intent === 'manage') return Promise.reject(restricted);
        return Promise.resolve({ role: BusinessMemberRole.OWNER });
      },
    );
    const businesses = { requireMembership } as unknown as BusinessesService;
    return { prisma, businesses, requireMembership, writes };
  }

  it('checks restriction before creating a business or ownership records', async () => {
    const { prisma, writes } = setup();
    const restrictions = {
      assertAllowed: jest.fn().mockRejectedValue(restricted),
    };
    const service = new BusinessesService(
      prisma as never,
      restrictions as never,
    );
    await expect(service.create(userId, {} as never)).rejects.toBe(restricted);
    expect(restrictions.assertAllowed).toHaveBeenCalledWith(
      userId,
      'BUSINESS_MANAGEMENT',
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(writes.create).not.toHaveBeenCalled();
  });

  it('keeps private media and verification IDs scoped before capability denial', async () => {
    const { prisma, businesses, requireMembership, writes } = setup();
    prisma.businessVerification.findFirst.mockResolvedValue(null);
    const verification = new BusinessVerificationsService(
      prisma as never,
      businesses,
      { putObject: writes.putObject } as never,
    );
    await expect(
      verification.uploadDocument(
        userId,
        businessId,
        serviceId,
        VerificationDocumentType.OWNER_ID,
        {} as never,
      ),
    ).rejects.toHaveProperty('status', 404);
    expect(requireMembership).not.toHaveBeenCalledWith(
      userId,
      businessId,
      expect.any(Array),
      'manage',
    );
    const media = new BusinessMediaService(prisma as never, businesses, {
      putObject: writes.putObject,
    } as never);
    await expect(
      media.update(userId, businessId, serviceId, {}),
    ).rejects.toHaveProperty('status', 404);
    await expect(
      media.archive(userId, businessId, serviceId),
    ).rejects.toHaveProperty('status', 404);
    expect(writes.putObject).not.toHaveBeenCalled();
    expect(writes.update).not.toHaveBeenCalled();
  });

  const cases: Array<{
    surface: string;
    invoke: (context: ReturnType<typeof setup>) => Promise<unknown>;
  }> = [
    {
      surface: 'business members',
      invoke: ({ prisma, businesses }) =>
        new BusinessMembersService(prisma as never, businesses).createMember(
          userId,
          businessId,
          { userId: serviceId, role: BusinessMemberRole.STAFF },
        ),
    },
    {
      surface: 'business locations',
      invoke: ({ prisma, businesses }) =>
        new BusinessLocationsService(prisma as never, businesses).create(
          userId,
          businessId,
          {} as never,
        ),
    },
    {
      surface: 'business verification draft',
      invoke: ({ prisma, businesses }) =>
        new BusinessVerificationsService(
          prisma as never,
          businesses,
        ).getOrCreateDraft(userId, businessId),
    },
    {
      surface: 'business private-document upload',
      invoke: ({ prisma, businesses, writes }) =>
        new BusinessVerificationsService(prisma as never, businesses, {
          putObject: writes.putObject,
        } as never).uploadDocument(
          userId,
          businessId,
          serviceId,
          VerificationDocumentType.OWNER_ID,
          {} as never,
        ),
    },
    {
      surface: 'business media upload',
      invoke: ({ prisma, businesses, writes }) =>
        new BusinessMediaService(prisma as never, businesses, {
          putObject: writes.putObject,
        } as never).upload(userId, businessId, {} as never, {} as never),
    },
    {
      surface: 'services',
      invoke: ({ prisma, businesses }) =>
        new ServicesService(prisma as never, businesses).updateMine(
          userId,
          businessId,
          serviceId,
          {},
        ),
    },
    {
      surface: 'accommodation details',
      invoke: ({ prisma, businesses }) =>
        new AccommodationService(prisma as never, businesses).updateDetail(
          userId,
          businessId,
          serviceId,
          {},
        ),
    },
    {
      surface: 'business review response',
      invoke: ({ prisma, businesses }) =>
        new BusinessOperationsService(
          prisma as never,
          businesses,
        ).upsertReviewResponse(userId, businessId, serviceId, {
          body: 'Thank you',
        }),
    },
    {
      surface: 'service availability configuration',
      invoke: ({ prisma, businesses }) =>
        new BookingsService(prisma as never, businesses, {
          assertAllowed: jest.fn(),
        } as never).upsertConfig(userId, serviceId, {}),
    },
    {
      surface: 'business booking confirmation',
      invoke: ({ prisma, businesses }) =>
        new BookingsService(prisma as never, businesses, {
          assertAllowed: jest.fn(),
        } as never).confirmBusiness(userId, businessId, serviceId, {}),
    },
  ];

  it.each(cases)(
    '$surface checks management policy before side effects',
    async ({ invoke }) => {
      const context = setup();
      await expect(invoke(context)).rejects.toBe(restricted);
      expect(context.requireMembership).toHaveBeenCalledWith(
        userId,
        businessId,
        expect.any(Array),
        'manage',
      );
      for (const write of Object.values(context.writes))
        expect(write).not.toHaveBeenCalled();
      expect(context.prisma.$transaction).not.toHaveBeenCalled();
    },
  );
});
