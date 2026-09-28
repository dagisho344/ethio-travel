import { randomUUID } from 'node:crypto';
import {
  AttractionCategory,
  BusinessStatus,
  BusinessVerificationSummary,
  LocationStatus,
  PricingModel,
  Prisma,
  PrismaClient,
  PublicationStatus,
  ServiceStatus,
} from '@prisma/client';
import {
  publicAttractionWhere,
  publicBusinessWhere,
  publicDestinationWhere,
  publicServiceWhere,
} from '../src/common/utils/public-visibility.util';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  SearchEntityType,
  SearchQueryDto,
  SearchSort,
} from '../src/search/dto/search-query.dto';
import { SearchService } from '../src/search/search.service';

// Explicit opt-in: node --env-file=.env + DISCOVERY_DATABASE_TESTS=1.
// Fixtures are isolated by a random Region slug and ALWAYS rolled back.
const databaseDescribe =
  process.env.DISCOVERY_DATABASE_TESTS === '1' ? describe : describe.skip;
const rollback = new Error('Rollback discovery test fixtures');

async function fixture(tx: Prisma.TransactionClient) {
  const suffix = randomUUID();
  const region = await tx.region.create({
    data: {
      name: 'F4 Test Region',
      slug: `f4-${suffix}`,
      status: LocationStatus.ACTIVE,
    },
  });
  const city = await tx.city.create({
    data: {
      regionId: region.id,
      name: 'F4 Test City',
      slug: 'f4-city',
      latitude: '6.1',
      longitude: '37.1',
      status: LocationStatus.ACTIVE,
    },
  });
  const destinations = [];
  for (const [index, name] of [
    'A Museum',
    'B Gallery',
    'Y Lake',
    'Z Lake',
  ].entries()) {
    destinations.push(
      await tx.destination.create({
        data: {
          cityId: city.id,
          name,
          slug: `f4-destination-${index}`,
          shortDescription: 'Lake history',
          fullDescription: 'Lake history',
          latitude: '6.1',
          longitude: '37.1',
          status: PublicationStatus.PUBLISHED,
          createdAt: new Date('2026-01-01T00:00:00Z'),
        },
      }),
    );
  }
  const attraction = await tx.attraction.create({
    data: {
      destinationId: destinations[0]!.id,
      name: 'Lake Attraction',
      slug: 'f4-attraction',
      category: AttractionCategory.OTHER,
      description: 'Lake history',
      latitude: '6.1',
      longitude: '37.1',
      status: PublicationStatus.PUBLISHED,
    },
  });
  const businessCategory = await tx.businessCategory.create({
    data: {
      code: `F4_${suffix.replaceAll('-', '')}`,
      name: 'F4 Test Business Category',
    },
  });
  const serviceCategory = await tx.serviceCategory.create({
    data: {
      code: `F4_${suffix.replaceAll('-', '')}`,
      name: 'F4 Test Service Category',
    },
  });
  const business = await tx.business.create({
    data: {
      cityId: city.id,
      categoryId: businessCategory.id,
      name: 'Lake Business',
      slug: 'f4-business',
      description: 'Lake business',
      addressLine1: 'F4 address',
      latitude: '6.1',
      longitude: '37.1',
      status: BusinessStatus.ACTIVE,
      verificationSummary: BusinessVerificationSummary.VERIFIED,
    },
  });
  const service = await tx.service.create({
    data: {
      businessId: business.id,
      categoryId: serviceCategory.id,
      name: 'Lake Service',
      slug: 'f4-service',
      shortDescription: 'Lake service',
      description: 'Lake service',
      price: new Prisma.Decimal('10.10'),
      currency: 'ETB',
      pricingModel: PricingModel.FIXED,
      status: ServiceStatus.PUBLISHED,
    },
  });
  const adapter = {
    destination: tx.destination,
    attraction: tx.attraction,
    business: tx.business,
    service: tx.service,
    $transaction: (
      callback: (client: Prisma.TransactionClient) => Promise<unknown>,
    ) => callback(tx),
  };
  return {
    region,
    city,
    destinations,
    attraction,
    businessCategory,
    serviceCategory,
    business,
    service,
    search: new SearchService(adapter as unknown as PrismaService),
  };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;

databaseDescribe('F4A-0 actual PostgreSQL ranked Search', () => {
  const prisma = new PrismaClient();
  afterAll(async () => {
    await prisma.$disconnect();
  });
  async function within(
    callback: (tx: Prisma.TransactionClient, data: Fixture) => Promise<void>,
  ) {
    try {
      await prisma.$transaction(
        async (tx) => {
          await callback(tx, await fixture(tx));
          throw rollback;
        },
        { timeout: 60_000 },
      );
    } catch (error) {
      if (error !== rollback) throw error;
    }
  }
  function query(
    data: Fixture,
    overrides: Partial<SearchQueryDto> = {},
  ): SearchQueryDto {
    return {
      page: 1,
      limit: 20,
      regionSlug: data.region.slug,
      sort: SearchSort.RELEVANCE,
      ...overrides,
    };
  }

  it('ranks before paging and never repeats or omits the alphabetical-prefix fixture', async () => {
    await within(async (_tx, data) => {
      const expected = ['Y Lake', 'Z Lake', 'A Museum', 'B Gallery'];
      const names: string[] = [];
      for (let page = 1; page <= 4; page++) {
        const result = await data.search.search(
          query(data, {
            page,
            limit: 1,
            q: 'Lake',
            types: [SearchEntityType.DESTINATION],
          }),
        );
        expect(result.meta).toEqual({
          page,
          limit: 1,
          total: 4,
          totalPages: 4,
        });
        names.push(...result.data.map((item) => item.name));
      }
      expect(names).toEqual(expected);
      expect(new Set(names).size).toBe(4);
      const emptyPage = await data.search.search(
        query(data, {
          page: 5,
          limit: 1,
          types: [SearchEntityType.DESTINATION],
        }),
      );
      expect(emptyPage.data).toEqual([]);
      expect(emptyPage.meta.total).toBe(4);
    });
  });

  it.each([
    SearchSort.RELEVANCE,
    SearchSort.NAME_ASC,
    SearchSort.NAME_DESC,
    SearchSort.NEWEST,
  ])('uses canonical name/type/ID ties for %s', async (sort) => {
    await within(async (tx, data) => {
      const name = 'Lake Same';
      const createdAt = new Date('2026-01-01T00:00:00Z');
      await tx.destination.updateMany({
        where: { cityId: data.city.id },
        data: { name, createdAt },
      });
      await tx.attraction.update({
        where: { id: data.attraction.id },
        data: { name, createdAt },
      });
      await tx.business.update({
        where: { id: data.business.id },
        data: { name, createdAt },
      });
      await tx.service.update({
        where: { id: data.service.id },
        data: { name, createdAt },
      });
      const expected = [
        data.attraction.id,
        data.business.id,
        ...data.destinations.map((item) => item.id).sort(),
        data.service.id,
      ];
      const ids: string[] = [];
      for (let page = 1; page <= expected.length; page++) {
        const result = await data.search.search(
          query(data, { page, limit: 1, q: 'Lake', sort }),
        );
        expect(result.meta.total).toBe(expected.length);
        ids.push(...result.data.map((item) => item.id));
      }
      expect(ids).toEqual(expected);
    });
  });

  it('keeps literal Unicode name matches strong with consistent database case folding', async () => {
    await within(async (tx, data) => {
      await tx.destination.updateMany({
        where: { cityId: data.city.id },
        data: {
          shortDescription: '\u0130 history',
          fullDescription: '\u0130 history',
        },
      });
      await tx.destination.update({
        where: { id: data.destinations[2]!.id },
        data: { name: 'Y \u0130 Lake' },
      });
      const result = await data.search.search(
        query(data, {
          q: '\u0130',
          types: [SearchEntityType.DESTINATION],
          limit: 1,
        }),
      );
      expect(result.meta.total).toBe(4);
      expect(result.data[0]?.id).toBe(data.destinations[2]!.id);
    });
  });

  it('orders non-tied canonical names and creation times before paging', async () => {
    await within(async (tx, data) => {
      for (const [index, row] of data.destinations.entries()) {
        await tx.destination.update({
          where: { id: row.id },
          data: { createdAt: new Date(`2026-01-0${index + 1}T00:00:00Z`) },
        });
      }
      for (const [sort, expected] of [
        [SearchSort.NAME_ASC, ['A Museum', 'B Gallery', 'Y Lake', 'Z Lake']],
        [SearchSort.NAME_DESC, ['Z Lake', 'Y Lake', 'B Gallery', 'A Museum']],
        [SearchSort.NEWEST, ['Z Lake', 'Y Lake', 'B Gallery', 'A Museum']],
      ] as const) {
        const names: string[] = [];
        for (let page = 1; page <= 2; page++) {
          const result = await data.search.search(
            query(data, {
              sort,
              page,
              limit: 2,
              types: [SearchEntityType.DESTINATION],
            }),
          );
          expect(result.meta.total).toBe(4);
          names.push(...result.data.map((row) => row.name));
        }
        expect(names).toEqual(expected);
      }
    });
  });

  it('keeps ordinary searches larger than 1000 valid and preserves the page window guard', async () => {
    await within(async (tx, data) => {
      await tx.destination.createMany({
        data: Array.from({ length: 1005 }, (_, index) => ({
          cityId: data.city.id,
          name: `LargeOnly ${String(index).padStart(4, '0')}`,
          slug: `large-only-${index}`,
          shortDescription: 'Large only',
          fullDescription: 'Large only',
          latitude: '6.1',
          longitude: '37.1',
          status: PublicationStatus.PUBLISHED,
        })),
      });
      const first = await data.search.search(
        query(data, {
          q: 'LargeOnly',
          types: [SearchEntityType.DESTINATION],
          limit: 1,
        }),
      );
      expect(first.meta.total).toBe(1005);
      expect(first.data[0]?.name).toBe('LargeOnly 0000');
      const last = await data.search.search(
        query(data, {
          q: 'LargeOnly',
          types: [SearchEntityType.DESTINATION],
          limit: 1,
          page: 1000,
        }),
      );
      expect(last.data[0]?.name).toBe('LargeOnly 0999');
      await expect(
        data.search.search(query(data, { page: 1001, limit: 1 })),
      ).rejects.toThrow('first 1000 results');
    });
  });

  it('matches actual central Prisma visibility builders across parent and entity lifecycle changes', async () => {
    await within(async (tx, data) => {
      const check = async () => {
        const scope = { regionSlug: data.region.slug };
        const results = await data.search.search(query(data));
        const [destinations, attractions, businesses, services] =
          await Promise.all([
            tx.destination.findMany({
              where: publicDestinationWhere(scope),
              select: { id: true },
            }),
            tx.attraction.findMany({
              where: publicAttractionWhere(scope),
              select: { id: true },
            }),
            tx.business.findMany({
              where: publicBusinessWhere(scope),
              select: { id: true },
            }),
            tx.service.findMany({
              where: publicServiceWhere(scope),
              select: { id: true },
            }),
          ]);
        const expected = [
          destinations.map((row) => `destination:${row.id}`),
          attractions.map((row) => `attraction:${row.id}`),
          businesses.map((row) => `business:${row.id}`),
          services.map((row) => `service:${row.id}`),
        ]
          .flat()
          .sort();
        expect(
          results.data.map((row) => `${row.type}:${row.id}`).sort(),
        ).toEqual(expected);
        expect(results.meta.total).toBe(expected.length);
      };
      await check();
      await tx.destination.update({
        where: { id: data.destinations[0]!.id },
        data: { status: PublicationStatus.DRAFT },
      });
      await check();
      await tx.business.update({
        where: { id: data.business.id },
        data: { destinationId: data.destinations[0]!.id },
      });
      await check();
      await tx.destination.update({
        where: { id: data.destinations[0]!.id },
        data: { status: PublicationStatus.PUBLISHED },
      });
      await check();
      await tx.attraction.update({
        where: { id: data.attraction.id },
        data: { status: PublicationStatus.INACTIVE },
      });
      await check();
      await tx.business.update({
        where: { id: data.business.id },
        data: { status: BusinessStatus.SUSPENDED },
      });
      await check();
      await tx.business.update({
        where: { id: data.business.id },
        data: {
          status: BusinessStatus.ACTIVE,
          verificationSummary: BusinessVerificationSummary.NOT_SUBMITTED,
        },
      });
      await check();
      await tx.business.update({
        where: { id: data.business.id },
        data: { verificationSummary: BusinessVerificationSummary.VERIFIED },
      });
      await tx.businessCategory.update({
        where: { id: data.businessCategory.id },
        data: { isActive: false },
      });
      await check();
      await tx.businessCategory.update({
        where: { id: data.businessCategory.id },
        data: { isActive: true },
      });
      await tx.serviceCategory.update({
        where: { id: data.serviceCategory.id },
        data: { isActive: false },
      });
      await check();
      await tx.serviceCategory.update({
        where: { id: data.serviceCategory.id },
        data: { isActive: true },
      });
      await tx.service.update({
        where: { id: data.service.id },
        data: { status: ServiceStatus.DRAFT },
      });
      await check();
      await tx.city.update({
        where: { id: data.city.id },
        data: { status: LocationStatus.INACTIVE },
      });
      await check();
      await tx.city.update({
        where: { id: data.city.id },
        data: { status: LocationStatus.ACTIVE },
      });
      await tx.region.update({
        where: { id: data.region.id },
        data: { status: LocationStatus.INACTIVE },
      });
      await check();
    });
  });

  it('preserves scoped/category/pricing filters, pattern matching, parameter safety and response privacy', async () => {
    await within(async (tx, data) => {
      await tx.business.update({
        where: { id: data.business.id },
        data: { destinationId: data.destinations[0]!.id },
      });
      const scoped = await data.search.search(
        query(data, {
          citySlug: data.city.slug,
          destinationSlug: data.destinations[0]!.slug,
        }),
      );
      expect(scoped.meta.total).toBe(4);
      const filtered = await data.search.search(
        query(data, {
          businessCategory: data.businessCategory.code,
          serviceCategory: data.serviceCategory.code,
          pricingModel: PricingModel.FIXED,
          currency: 'ETB',
          minPrice: 10.1,
          maxPrice: 10.1,
        }),
      );
      expect(filtered.data.map((row) => row.id)).toEqual([data.service.id]);
      expect(filtered.data[0]?.price?.toString()).toBe('10.1');
      expect(
        (await data.search.search(query(data, { currency: 'USD' }))).meta.total,
      ).toBe(0);
      expect(
        (await data.search.search(query(data, { citySlug: 'other-city' }))).meta
          .total,
      ).toBe(0);
      const wildcard = await data.search.search(
        query(data, { q: '%', types: [SearchEntityType.DESTINATION] }),
      );
      expect(wildcard.meta.total).toBe(4);
      expect(
        (await data.search.search(query(data, { q: "Lake%' OR 1=1 --" }))).meta
          .total,
      ).toBe(0);
      expect(
        (await data.search.search(query(data, { regionSlug: "' OR 1=1 --" })))
          .meta.total,
      ).toBe(0);
      for (const item of scoped.data) {
        expect(Object.keys(item).sort()).toEqual([
          'category',
          'currency',
          'distanceKm',
          'id',
          'latitude',
          'location',
          'longitude',
          'name',
          'price',
          'pricingModel',
          'shortDescription',
          'slug',
          'type',
        ]);
      }
    });
  });
});
