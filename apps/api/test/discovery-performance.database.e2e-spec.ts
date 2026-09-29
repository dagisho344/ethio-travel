import { createHash, randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import {
  AttractionCategory,
  BusinessStatus,
  BusinessVerificationSummary,
  EditorialLocale,
  LocationStatus,
  PricingModel,
  Prisma,
  PrismaClient,
  PublicationStatus,
  ServiceStatus,
} from '@prisma/client';
import { MapsService } from '../src/maps/maps.service';
import { MapPlacesQueryDto } from '../src/maps/dto/map-places-query.dto';
import { PrismaService } from '../src/prisma/prisma.service';
import { SearchService } from '../src/search/search.service';
import {
  SearchEntityType,
  SearchQueryDto,
  SearchSort,
} from '../src/search/dto/search-query.dto';

// No normal-suite database work. Uses the existing discovery opt-in and only
// loopback development databases. No credentials, SQL values or editorial
// bodies are printed. Fixture writes roll back; ANALYZE estimates are refreshed
// against the original live rows in finally (not all ANALYZE effects roll back).
const databaseDescribe =
  process.env.DISCOVERY_DATABASE_TESTS === '1' ? describe : describe.skip;
const scales = [100, 1_000, 10_000];
const repeats = 5;
const rollback = new Error('Rollback performance fixtures');
const amName = 'ሐይቅሙከራ';
const amSnippet = 'ጉዞሙከራ';
const hiddenTerm = 'ሚስጥርሙከራ';

async function counts(client: PrismaClient) {
  return {
    destinations: await client.destination.count(),
    translations: await client.destinationTranslation.count(),
    cities: await client.city.count(),
    regions: await client.region.count(),
    attractions: await client.attraction.count(),
    businesses: await client.business.count(),
    services: await client.service.count(),
    businessCategories: await client.businessCategory.count(),
    serviceCategories: await client.serviceCategory.count(),
  };
}

async function catalog(client: PrismaClient) {
  const indexes = await client.$queryRaw<unknown[]>`
    SELECT tablename, indexname, indexdef FROM pg_indexes
    WHERE schemaname = 'public' AND tablename IN
    ('destinations','destination_translations','cities','regions','attractions','businesses','services')
    ORDER BY tablename, indexname`;
  const extensions = await client.$queryRaw<unknown[]>`
    SELECT extname, extversion FROM pg_extension ORDER BY extname`;
  return { indexes, extensions };
}

async function baseFixture(tx: Prisma.TransactionClient) {
  const suffix = randomUUID();
  const regions = Array.from({ length: 3 }, (_, i) => ({
    id: randomUUID(),
    name: `Performance Region ${i}`,
    slug: `f4a3-${suffix}-${i}`,
    status: LocationStatus.ACTIVE,
  }));
  await tx.region.createMany({ data: regions });
  const cities = Array.from({ length: 30 }, (_, i) => ({
    id: randomUUID(),
    regionId: regions[i % 3]!.id,
    name: `Performance City ${i}`,
    slug: `performance-city-${i}`,
    latitude: '6.1',
    longitude: '37.1',
    status: i < 28 ? LocationStatus.ACTIVE : LocationStatus.INACTIVE,
  }));
  await tx.city.createMany({ data: cities });
  const code = `F4A3_${suffix.replaceAll('-', '').toUpperCase()}`;
  const businessCategory = await tx.businessCategory.create({
    data: { code, name: 'Benchmark category' },
  });
  const serviceCategory = await tx.serviceCategory.create({
    data: { code, name: 'Benchmark category' },
  });
  const destinations: Prisma.DestinationCreateManyInput[] = [];
  const adapter = {
    destination: tx.destination,
    attraction: tx.attraction,
    business: tx.business,
    service: tx.service,
    review: tx.review,
    $transaction: (
      callback: (client: Prisma.TransactionClient) => Promise<unknown>,
    ) => callback(tx),
  };
  return {
    regions,
    cities,
    businessCategory,
    serviceCategory,
    destinations,
    search: new SearchService(adapter as unknown as PrismaService),
    maps: new MapsService(adapter as unknown as PrismaService),
  };
}
type Fixture = Awaited<ReturnType<typeof baseFixture>>;

async function grow(
  tx: Prisma.TransactionClient,
  fixture: Fixture,
  size: number,
) {
  const start = fixture.destinations.length;
  const destinations: Prisma.DestinationCreateManyInput[] = [];
  const translations: Prisma.DestinationTranslationCreateManyInput[] = [];
  const attractions: Prisma.AttractionCreateManyInput[] = [];
  const businesses: Prisma.BusinessCreateManyInput[] = [];
  const services: Prisma.ServiceCreateManyInput[] = [];
  for (let i = start; i < size; i++) {
    const id = randomUUID();
    const city = fixture.cities[i % 30]!;
    const coordinates = {
      latitude: String(6.1 + (i % 100) / 1_000),
      longitude: String(37.1 + (Math.floor(i / 100) % 100) / 1_000),
    };
    destinations.push({
      id,
      cityId: city.id,
      name: `${i % 100 === 0 ? 'F4A3Needle' : i % 4 === 0 ? 'F4A3Lake' : 'F4A3Hill'} ${String(i).padStart(5, '0')}${i % 10 === 0 ? ' F4A3Dual' : ''}`,
      slug: `performance-destination-${i}`,
      shortDescription:
        i % 5 === 0 ? 'F4A3Brief guidance' : 'Canonical editorial guidance',
      fullDescription: `${i % 3 === 0 ? 'F4A3History ' : ''}${'Canonical history and travel information. '.repeat(40)}`,
      status:
        i % 20 === 19 ? PublicationStatus.DRAFT : PublicationStatus.PUBLISHED,
      createdAt: new Date(Date.UTC(2026, 0, 1 + (i % 28))),
      ...coordinates,
    });
    const mix = i % 10;
    if (mix !== 9)
      translations.push({
        destinationId: id,
        locale: EditorialLocale.am,
        displayName:
          mix === 4
            ? null
            : `${mix < 5 ? amName : hiddenTerm} ${i}${mix === 0 ? ' F4A3Dual' : ''}`,
        shortDescription:
          mix === 7 ? '\t\u00a0' : `${mix < 5 ? amSnippet : hiddenTerm} መግለጫ`,
        fullDescription: mix === 8 ? '\u2003\ufeff' : 'የጉዞ መረጃ። '.repeat(80),
        isPublished: mix !== 5 && mix !== 6,
        publishedAt: mix < 5 ? new Date('2026-01-01T00:00:00Z') : null,
      });
    if (i % 2 === 0)
      attractions.push({
        id: randomUUID(),
        destinationId: id,
        name: `F4A3Attraction ${i}`,
        slug: `performance-attraction-${i}`,
        category: AttractionCategory.OTHER,
        description: 'F4A3Common attraction prose',
        status: PublicationStatus.PUBLISHED,
        ...coordinates,
      });
    if (i % 4 === 0) {
      const businessId = randomUUID();
      businesses.push({
        id: businessId,
        cityId: city.id,
        destinationId: id,
        categoryId: fixture.businessCategory.id,
        name: `F4A3Business ${i}`,
        slug: `performance-business-${i}`,
        description: 'F4A3Common business prose',
        addressLine1: 'Benchmark address',
        status:
          i % 100 === 96 ? BusinessStatus.SUSPENDED : BusinessStatus.ACTIVE,
        verificationSummary: BusinessVerificationSummary.VERIFIED,
        ...coordinates,
      });
      for (let j = 0; j < 2; j++)
        services.push({
          id: randomUUID(),
          businessId,
          categoryId: fixture.serviceCategory.id,
          name: `F4A3Service ${i}-${j}`,
          slug: `performance-service-${i}-${j}`,
          shortDescription: 'F4A3Common service prose',
          description: 'Canonical service description',
          pricingModel: PricingModel.FIXED,
          price: new Prisma.Decimal('25.50'),
          currency: j === 0 ? 'ETB' : 'USD',
          status: ServiceStatus.PUBLISHED,
        });
    }
  }
  // Keep bind counts and allocations modest. Only new UUID fixture rows are written.
  for (let i = 0; i < destinations.length; i += 500)
    await tx.destination.createMany({ data: destinations.slice(i, i + 500) });
  for (let i = 0; i < translations.length; i += 500)
    await tx.destinationTranslation.createMany({
      data: translations.slice(i, i + 500),
    });
  for (let i = 0; i < attractions.length; i += 500)
    await tx.attraction.createMany({ data: attractions.slice(i, i + 500) });
  for (let i = 0; i < businesses.length; i += 500)
    await tx.business.createMany({ data: businesses.slice(i, i + 500) });
  for (let i = 0; i < services.length; i += 500)
    await tx.service.createMany({ data: services.slice(i, i + 500) });
  fixture.destinations.push(...destinations);
  // Same production tables/SQL with representative planner statistics, not
  // tiny pre-fixture estimates. Re-ANALYZE live rows after rollback in finally.
  await tx.$executeRaw`ANALYZE public.destinations, public.destination_translations, public.cities, public.regions, public.attractions, public.businesses, public.services`;
}

type PlanNode = Record<string, unknown> & { Plans?: PlanNode[] };
function capturedValues(params: string): unknown[] {
  // QueryEvent.params in this Prisma engine emits literal C0 characters in
  // string values (including the production trim alphabet), not valid JSON.
  // Escape only characters INSIDE JSON strings; preserve their exact values.
  let inside = false;
  let escaped = false;
  let json = '';
  for (const character of params) {
    if (character === '"' && !escaped) inside = !inside;
    json +=
      inside && character.charCodeAt(0) < 32
        ? `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`
        : character;
    escaped = character === '\\' && !escaped;
  }
  const values: unknown = JSON.parse(json);
  if (!Array.isArray(values))
    throw new Error('Invalid captured query parameters');
  return values as unknown[];
}
let preparedCounter = 0;
const parameterTypes = new Set([
  'text',
  'character',
  'character varying',
  'uuid',
  'uuid[]',
  'integer',
  'bigint',
  'numeric',
  'boolean',
  'double precision',
  'timestamp without time zone',
  'timestamp with time zone',
  '"EditorialLocale"',
  '"PublicationStatus"',
  '"LocationStatus"',
  '"BusinessStatus"',
  '"BusinessVerificationSummary"',
  '"ServiceStatus"',
  '"ServiceLocationMode"',
  '"PricingModel"',
  '"ReviewStatus"',
]);
function planNodes(node: PlanNode): PlanNode[] {
  return [node, ...(node.Plans ?? []).flatMap(planNodes)];
}
async function explain(tx: Prisma.TransactionClient, event: Prisma.QueryEvent) {
  if (!/^\s*(SELECT|WITH)\b/i.test(event.query))
    throw new Error('Only captured production SELECT queries can be explained');
  const values = capturedValues(event.params);
  // Prisma's event format omits native parameter OIDs. Let PostgreSQL infer
  // the original SQL's exact types rather than replaying UUID/enums as text.
  // PREPARE is session-only; names are internal constants and are deallocated.
  const prepared = `f4a3_explain_${++preparedCounter}`;
  await tx.$executeRawUnsafe(`PREPARE ${prepared} AS ${event.query}`);
  let types: string[];
  try {
    const metadata = await tx.$queryRaw<{ types: string[] }[]>`
      SELECT parameter_types::text[] AS types FROM pg_prepared_statements WHERE name = ${prepared}`;
    types = metadata[0]?.types ?? [];
    if (
      types.length !== values.length ||
      types.some((type) => !parameterTypes.has(type))
    )
      throw new Error(
        `Unsupported captured parameter types: ${JSON.stringify(types)}`,
      );
  } finally {
    await tx.$executeRawUnsafe(`DEALLOCATE ${prepared}`);
  }
  const typedSql = event.query.replace(/\$(\d+)\b/g, (_, index: string) => {
    const type = types[Number(index) - 1];
    if (!type) throw new Error('Missing captured parameter type');
    // SQL's character alias defaults to CHAR(1); the inferred native bpchar
    // type has no typmod and must not truncate a three-letter currency value.
    return `$${index}::${type === 'character' ? 'pg_catalog.bpchar' : type}`;
  });
  // SQL is captured from Prisma/production code, never caller-provided. Its
  // original values remain separate bound arguments (including all ILIKEs).
  const rows = await tx.$queryRawUnsafe<{ 'QUERY PLAN': unknown }[]>(
    `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${typedSql}`,
    ...values,
  );
  const raw = rows[0]?.['QUERY PLAN'];
  if (!Array.isArray(raw) || !raw[0] || typeof raw[0] !== 'object')
    throw new Error('Invalid PostgreSQL plan');
  const document = raw[0] as Record<string, unknown>;
  const root = document.Plan as PlanNode;
  return {
    fingerprint: createHash('sha256')
      .update(event.query)
      .digest('hex')
      .slice(0, 12),
    planningMs: document['Planning Time'],
    executionMs: document['Execution Time'],
    nodes: planNodes(root).map((node) =>
      Object.fromEntries(
        [
          'Node Type',
          'Relation Name',
          'Index Name',
          'Actual Rows',
          'Actual Loops',
          'Rows Removed by Filter',
          'Rows Removed by Join Filter',
          'Rows Removed by Index Recheck',
          'Plan Rows',
          'Actual Total Time',
          'Sort Method',
          'Sort Space Used',
          'Sort Space Type',
          'Hash Batches',
          'Peak Memory Usage',
          'Shared Hit Blocks',
          'Shared Read Blocks',
          'Temp Read Blocks',
          'Temp Written Blocks',
        ]
          .filter((key) => node[key] !== undefined)
          .map((key) => [key, node[key]]),
      ),
    ),
  };
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  return Number(sorted[Math.floor(sorted.length / 2)]!.toFixed(3));
}
type Workload = {
  name: string;
  run: () => Promise<{ total: number | null; returned: number }>;
  plans?: boolean;
};

databaseDescribe('F4A-3 opt-in discovery performance assessment', () => {
  const prisma = new PrismaClient({ log: [{ emit: 'event', level: 'query' }] });
  let events: Prisma.QueryEvent[] = [];
  prisma.$on('query', (event) => {
    if (/^\s*(SELECT|WITH)\b/i.test(event.query)) events.push(event);
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('measures real service paths, rolls back fixtures and refreshes live statistics', async () => {
    const url = new URL(process.env.DATABASE_URL ?? '');
    expect(['localhost', '127.0.0.1', '[::1]']).toContain(url.hostname);
    const beforeCounts = await counts(prisma);
    const beforeCatalog = await catalog(prisma);
    const environment = await prisma.$queryRaw<unknown[]>`
      SELECT version(), pg_encoding_to_char(encoding) AS encoding, datcollate,
      datctype, current_setting('default_text_search_config') AS text_search,
      current_setting('shared_buffers') AS shared_buffers, current_setting('work_mem') AS work_mem
      FROM pg_database WHERE datname = current_database()`;
    console.log(
      'F4A3_ENVIRONMENT',
      JSON.stringify({
        environment,
        counts: beforeCounts,
        indexes: beforeCatalog.indexes,
        extensions: beforeCatalog.extensions,
      }),
    );
    let fixtureRegionIds: string[] = [];
    try {
      await prisma.$transaction(
        async (tx) => {
          const fixture = await baseFixture(tx);
          fixtureRegionIds = fixture.regions.map((row) => row.id);
          for (const size of scales) {
            await grow(tx, fixture, size);
            const search = (
              overrides: Partial<SearchQueryDto> = {},
            ): SearchQueryDto => ({
              page: 1,
              limit: 20,
              sort: SearchSort.RELEVANCE,
              types: [SearchEntityType.DESTINATION],
              locale: EditorialLocale.en,
              ...overrides,
            });
            const map = (
              overrides: Partial<MapPlacesQueryDto> = {},
            ): MapPlacesQueryDto => ({
              north: 6.12,
              south: 6.1,
              east: 37.12,
              west: 37.1,
              limit: 200,
              types: [SearchEntityType.DESTINATION],
              locale: EditorialLocale.en,
              ...overrides,
            });
            const searchCase = (
              name: string,
              overrides: Partial<SearchQueryDto>,
              plans = false,
            ): Workload => ({
              name,
              plans,
              run: async () => {
                const result = await fixture.search.search(search(overrides));
                return {
                  total: result.meta.total,
                  returned: result.data.length,
                };
              },
            });
            const mapCase = (
              name: string,
              overrides: Partial<MapPlacesQueryDto>,
              plans = false,
            ): Workload => ({
              name,
              plans,
              run: async () => {
                const result = await fixture.maps.findPlaces(map(overrides));
                expect(result.data.length).toBeLessThanOrEqual(200);
                return { total: null, returned: result.data.length };
              },
            });
            const workloads = [
              searchCase('en_rare_name', { q: 'F4A3Needle' }, true),
              searchCase('en_name', { q: 'F4A3Lake' }),
              searchCase('en_short_prose', { q: 'F4A3Brief' }),
              searchCase('en_full_prose', { q: 'F4A3History' }),
              searchCase(
                'am_display_name',
                { q: amName, locale: EditorialLocale.am },
                true,
              ),
              searchCase('am_short_prose', {
                q: amSnippet,
                locale: EditorialLocale.am,
              }),
              searchCase(
                'am_rare_display_name',
                { q: `${amName} 100`, locale: EditorialLocale.am },
                true,
              ),
              searchCase('am_english_query', {
                q: 'F4A3Lake',
                locale: EditorialLocale.am,
              }),
              searchCase('am_dual_match', {
                q: 'F4A3Dual',
                locale: EditorialLocale.am,
              }),
              searchCase('am_hidden_incomplete', {
                q: hiddenTerm,
                locale: EditorialLocale.am,
              }),
              searchCase('en_no_match', { q: 'F4A3Absent' }, true),
              searchCase(
                'am_no_match',
                {
                  q: 'F4A3Absent',
                  locale: EditorialLocale.am,
                },
                true,
              ),
              searchCase('en_common_page1', { q: 'F4A3' }, true),
              searchCase(
                'am_common_page1',
                { q: 'F4A3', locale: EditorialLocale.am },
                true,
              ),
              searchCase('am_deep_page', {
                q: 'F4A3',
                locale: EditorialLocale.am,
                page: 40,
              }),
              searchCase(
                'all_types_common',
                {
                  q: 'F4A3',
                  types: Object.values(SearchEntityType),
                  locale: EditorialLocale.am,
                },
                true,
              ),
              searchCase('am_scoped_city', {
                q: amName,
                locale: EditorialLocale.am,
                regionSlug: fixture.regions[0]!.slug,
                citySlug: fixture.cities[0]!.slug,
              }),
              searchCase(
                'service_scoped_price',
                {
                  q: 'F4A3Service',
                  types: [SearchEntityType.SERVICE],
                  regionSlug: fixture.regions[0]!.slug,
                  citySlug: fixture.cities[0]!.slug,
                  destinationSlug: fixture.destinations[0]!.slug,
                  businessCategory: fixture.businessCategory.code,
                  serviceCategory: fixture.serviceCategory.code,
                  pricingModel: PricingModel.FIXED,
                  currency: 'ETB',
                  minPrice: 20,
                  maxPrice: 30,
                },
                true,
              ),
              mapCase('map_en_name', { q: 'F4A3Lake' }, true),
              mapCase(
                'map_am_name',
                { q: amName, locale: EditorialLocale.am },
                true,
              ),
              mapCase('map_all_types', {
                q: 'F4A3',
                types: Object.values(SearchEntityType),
                locale: EditorialLocale.am,
              }),
              searchCase('nearby_am_distance', {
                q: 'F4A3',
                locale: EditorialLocale.am,
                lat: 6.104,
                lng: 37.104,
                radiusKm: 1,
                sort: SearchSort.DISTANCE,
              }),
              mapCase('map_nearby_am', {
                q: 'F4A3',
                locale: EditorialLocale.am,
                lat: 6.104,
                lng: 37.104,
                radiusKm: 1,
              }),
            ];
            const expectedComplete = fixture.destinations.filter(
              (row, i) =>
                i % 10 < 5 &&
                i % 30 < 28 &&
                row.status === PublicationStatus.PUBLISHED,
            ).length;
            expect(
              (
                await fixture.search.search(
                  search({ q: amSnippet, locale: EditorialLocale.am }),
                )
              ).meta.total,
            ).toBe(expectedComplete);
            expect(
              (
                await fixture.search.search(
                  search({ q: hiddenTerm, locale: EditorialLocale.am }),
                )
              ).meta.total,
            ).toBe(0);
            const expectedDual = fixture.destinations.filter(
              (row, i) => i % 10 === 0 && i % 30 < 28,
            ).length;
            expect(
              (
                await fixture.search.search(
                  search({ q: 'F4A3Dual', locale: EditorialLocale.am }),
                )
              ).meta.total,
            ).toBe(expectedDual);
            const measurements = [];
            for (const workload of workloads) {
              events = [];
              const firstStart = performance.now();
              const first = await workload.run(); // first observed / warm-up, NOT a cold-cache claim
              const firstMs = performance.now() - firstStart;
              const timings: number[] = [];
              let statements: Prisma.QueryEvent[] = [];
              for (let repeat = 0; repeat < repeats; repeat++) {
                events = [];
                const start = performance.now();
                expect(await workload.run()).toEqual(first);
                timings.push(performance.now() - start);
                statements = [...events];
              }
              const plans =
                (size === scales[0] || size === scales.at(-1)) && workload.plans
                  ? await Promise.all(
                      statements.map((statement) => explain(tx, statement)),
                    )
                  : undefined;
              measurements.push({
                name: workload.name,
                ...first,
                firstMs: Number(firstMs.toFixed(3)),
                medianMs: median(timings),
                sqlStatements: statements.length,
                plans,
              });
            }
            console.log(
              'F4A3_SCALE',
              JSON.stringify({
                destinations: size,
                translations: size * 0.9,
                attractions: size / 2,
                businesses: size / 4,
                services: size / 2,
                measurements,
              }),
            );
          }
          throw rollback;
        },
        {
          timeout: 300_000,
          isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
        },
      );
    } catch (error) {
      if (error !== rollback) throw error;
    } finally {
      // PostgreSQL retains reltuples/relpages changes from ANALYZE even when the
      // surrounding transaction aborts. Refresh only these seven known tables
      // after rollback, including failures. No rows, indexes or extensions change.
      await prisma.$executeRaw`ANALYZE public.destinations, public.destination_translations, public.cities, public.regions, public.attractions, public.businesses, public.services`;
    }
    expect(
      await prisma.region.count({ where: { id: { in: fixtureRegionIds } } }),
    ).toBe(0);
    expect(await counts(prisma)).toEqual(beforeCounts);
    expect(await catalog(prisma)).toEqual(beforeCatalog);
    const estimates = await prisma.$queryRaw<
      { relname: string; rows: number }[]
    >`
      SELECT c.relname, c.reltuples::float8 AS rows FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname IN
      ('destinations','destination_translations','cities','regions','attractions','businesses','services')
      ORDER BY c.relname`;
    const liveCounts: Record<string, number> = {
      destinations: beforeCounts.destinations,
      destination_translations: beforeCounts.translations,
      cities: beforeCounts.cities,
      regions: beforeCounts.regions,
      attractions: beforeCounts.attractions,
      businesses: beforeCounts.businesses,
      services: beforeCounts.services,
    };
    for (const estimate of estimates) {
      // ANALYZE estimates can be sampled on larger pre-existing datasets.
      expect(estimate.rows).toBeGreaterThanOrEqual(0);
      if (liveCounts[estimate.relname] === 0) expect(estimate.rows).toBe(0);
    }
    console.log('F4A3_LIVE_ESTIMATES', JSON.stringify(estimates));
    console.log('F4A3_ROLLBACK_VERIFIED', JSON.stringify(beforeCounts));
  }, 300_000);
});
