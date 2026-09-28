import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EditorialLocale, PublicationStatus } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { DestinationsService } from './destinations.service';

const destinationId = '11111111-1111-1111-1111-111111111111';
const actorUserId = '22222222-2222-2222-2222-222222222222';

type DestinationTranslationFixture = {
  bestTimeToVisit: string | null;
  createdAt: Date;
  destinationId: string;
  displayName: string | null;
  fullDescription: string | null;
  gettingThere: string | null;
  id: string;
  isPublished: boolean;
  locale: EditorialLocale;
  localTips: string | null;
  publishedAt: Date | null;
  safetyNotes: string | null;
  shortDescription: string | null;
  updatedAt: Date;
};

type TransactionClientMock = {
  destinationTranslation: {
    findUnique: jest.Mock;
    update: jest.Mock;
    upsert: jest.Mock;
  };
};

type PrismaMock = {
  $transaction: jest.Mock;
  destination: {
    count: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
    findUnique: jest.Mock;
  };
  destinationTranslation: TransactionClientMock['destinationTranslation'];
};

function sourceDestination(translations: DestinationTranslationFixture[] = []) {
  return {
    archivedAt: null,
    cityId: '33333333-3333-3333-3333-333333333333',
    createdAt: new Date('2026-09-27T00:00:00.000Z'),
    fullDescription: 'Canonical English destination description.',
    id: destinationId,
    latitude: '6.855000',
    longitude: '37.761000',
    name: 'Wolaita Sodo',
    publishedAt: new Date('2026-09-27T00:00:00.000Z'),
    shortDescription: 'Canonical English summary.',
    slug: 'wolaita-sodo',
    status: PublicationStatus.PUBLISHED,
    travelInfo: {
      bestTimeToVisit: 'October to February',
      estimatedStayDays: 3,
      gettingThere: 'Road connection from Addis Ababa.',
    },
    translations,
    updatedAt: new Date('2026-09-27T00:00:00.000Z'),
  };
}

function translation(
  overrides: Partial<DestinationTranslationFixture> = {},
): DestinationTranslationFixture {
  return {
    bestTimeToVisit: 'ከጥቅምት እስከ የካቲት',
    createdAt: new Date('2026-09-27T00:00:00.000Z'),
    destinationId,
    displayName: null,
    fullDescription: 'የመዳረሻው ሙሉ የአማርኛ መግለጫ።',
    gettingThere: null,
    id: '44444444-4444-4444-4444-444444444444',
    isPublished: true,
    locale: EditorialLocale.am,
    localTips: null,
    publishedAt: new Date('2026-09-27T00:00:00.000Z'),
    safetyNotes: null,
    shortDescription: 'የመዳረሻው የአማርኛ አጭር መግለጫ።',
    updatedAt: new Date('2026-09-27T00:00:00.000Z'),
    ...overrides,
  };
}

function isTransactionCallback(
  value: unknown,
): value is (tx: TransactionClientMock) => Promise<unknown> {
  return typeof value === 'function';
}

function createPrismaMock(
  translations: DestinationTranslationFixture[] = [],
): PrismaMock {
  const destinationTranslation = {
    findUnique: jest.fn(() => Promise.resolve(translation())),
    update: jest.fn((input: { data: object }) =>
      Promise.resolve({ ...translation(), ...input.data }),
    ),
    upsert: jest.fn((input: { create: object }) =>
      Promise.resolve({ ...translation(), ...input.create }),
    ),
  };
  const tx: TransactionClientMock = { destinationTranslation };
  return {
    $transaction: jest.fn((input: unknown) => {
      if (Array.isArray(input)) return Promise.all(input);
      if (isTransactionCallback(input)) return input(tx);
      return Promise.reject(new Error('Unsupported transaction input.'));
    }),
    destination: {
      count: jest.fn(() => Promise.resolve(1)),
      findFirst: jest.fn(() =>
        Promise.resolve(sourceDestination(translations)),
      ),
      findMany: jest.fn(() =>
        Promise.resolve([sourceDestination(translations)]),
      ),
      findUnique: jest.fn(() => Promise.resolve(sourceDestination())),
    },
    destinationTranslation,
  };
}

function createService(prisma: PrismaMock, audit?: { record: jest.Mock }) {
  return new DestinationsService(
    prisma as unknown as PrismaService,
    audit as unknown as AuditService,
  );
}

describe('Phase 16D-F1 destination translations', () => {
  it('returns the canonical source destination for an omitted or English locale', async () => {
    const prisma = createPrismaMock([translation()]);
    const service = createService(prisma);

    const omitted = await service.findPublic({ limit: 20, page: 1 });
    const english = await service.findPublic({
      limit: 20,
      locale: EditorialLocale.en,
      page: 1,
    });

    expect(omitted.data[0]).toMatchObject({
      fullDescription: 'Canonical English destination description.',
      name: 'Wolaita Sodo',
    });
    expect(english.data[0]).toMatchObject({
      fullDescription: 'Canonical English destination description.',
      name: 'Wolaita Sodo',
    });
    expect(english.data[0]).not.toHaveProperty('translations');
  });

  it('resolves a complete published Amharic translation without changing shared travel data', async () => {
    const prisma = createPrismaMock([translation()]);
    const service = createService(prisma);

    const result = await service.findPublic({
      limit: 20,
      locale: EditorialLocale.am,
      page: 1,
    });
    const detail = await service.findPublicBySlugs(
      'south-ethiopia',
      'wolaita-sodo',
      'wolaita-sodo',
      EditorialLocale.am,
    );

    expect(result.data[0]).toMatchObject({
      fullDescription: 'የመዳረሻው ሙሉ የአማርኛ መግለጫ።',
      name: 'Wolaita Sodo',
      shortDescription: 'የመዳረሻው የአማርኛ አጭር መግለጫ።',
      travelInfo: expect.objectContaining({
        bestTimeToVisit: 'ከጥቅምት እስከ የካቲት',
        estimatedStayDays: 3,
      }),
    });
    expect(result.data[0]).not.toHaveProperty('translations');
    expect(detail).toMatchObject({
      fullDescription: 'የመዳረሻው ሙሉ የአማርኛ መግለጫ።',
    });
    expect(prisma.destination.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          translations: expect.objectContaining({
            where: { isPublished: true, locale: EditorialLocale.am },
          }),
        }),
      }),
    );
  });

  it.each([
    ['missing', []],
    ['draft', [translation({ isPublished: false })]],
    ['unpublished', []],
    ['incomplete', [translation({ fullDescription: '   ' })]],
  ])(
    'falls back to complete source content when Amharic is %s',
    async (_, translations) => {
      const prisma = createPrismaMock(translations);
      const service = createService(prisma);

      const result = await service.findPublic({
        limit: 20,
        locale: EditorialLocale.am,
        page: 1,
      });

      expect(result.data[0]).toMatchObject({
        fullDescription: 'Canonical English destination description.',
        shortDescription: 'Canonical English summary.',
      });
    },
  );

  it('saves normalized drafts without publishing and records only safe audit metadata', async () => {
    const prisma = createPrismaMock();
    const audit = { record: jest.fn(() => Promise.resolve()) };
    const service = createService(prisma, audit);

    await service.saveTranslation(
      destinationId,
      EditorialLocale.am,
      actorUserId,
      {
        displayName: '  ',
        fullDescription: '  የአማርኛ ሙሉ መግለጫ  ',
        shortDescription: '  አጭር መግለጫ  ',
      },
      {},
    );

    expect(prisma.destinationTranslation.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          displayName: null,
          fullDescription: 'የአማርኛ ሙሉ መግለጫ',
          isPublished: false,
          locale: EditorialLocale.am,
          publishedAt: null,
        }),
      }),
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        metadata: { destinationId, locale: EditorialLocale.am },
      }),
    );
    expect(JSON.stringify(audit.record.mock.calls)).not.toContain(
      'የአማርኛ ሙሉ መግለጫ',
    );

    await expect(
      service.saveTranslation(
        destinationId,
        EditorialLocale.en,
        actorUserId,
        {},
        {},
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('requires complete prose before publishing and restores fallback when unpublished', async () => {
    const prisma = createPrismaMock();
    prisma.destinationTranslation.findUnique.mockResolvedValueOnce(
      translation({ shortDescription: null }),
    );
    const service = createService(prisma);

    await expect(
      service.publishTranslation(
        destinationId,
        EditorialLocale.am,
        actorUserId,
        {},
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    prisma.destinationTranslation.findUnique.mockResolvedValueOnce(
      translation(),
    );
    await service.unpublishTranslation(
      destinationId,
      EditorialLocale.am,
      actorUserId,
      {},
    );
    expect(prisma.destinationTranslation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { isPublished: false, publishedAt: null },
        where: {
          destinationId_locale: { destinationId, locale: EditorialLocale.am },
        },
      }),
    );
  });

  it('uses the composite destination and locale identity for translation reads', async () => {
    const prisma = createPrismaMock();
    const service = createService(prisma);

    await service.findTranslation(destinationId, EditorialLocale.am);

    expect(prisma.destinationTranslation.findUnique).toHaveBeenCalledWith({
      where: {
        destinationId_locale: { destinationId, locale: EditorialLocale.am },
      },
    });

    prisma.destinationTranslation.findUnique.mockResolvedValueOnce(null);
    await expect(
      service.findTranslation(destinationId, EditorialLocale.am),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
