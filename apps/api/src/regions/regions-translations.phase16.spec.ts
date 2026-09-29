import {
  BadRequestException,
  CanActivate,
  ConflictException,
  ExecutionContext,
  INestApplication,
  NotFoundException,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  EditorialLocale,
  LocationStatus,
  Prisma,
  Region,
} from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import type { Server } from 'node:http';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import request from 'supertest';
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from '../audit/audit.constants';
import { AuditService, AuditWrite } from '../audit/audit.service';
import { AuthenticatedUser } from '../auth/authenticated-user';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import {
  PublicRegionQueryDto,
  RegionLocaleQueryDto,
} from './dto/public-region-query.dto';
import { UpsertRegionTranslationDto } from './dto/upsert-region-translation.dto';
import {
  isRegionTranslationComplete,
  localizedPublicRegionSelect,
  publicRegionSelect,
  PublicRegionEditorialTranslation,
  resolvePublicRegionEditorial,
} from './public-region-editorial.util';
import {
  AdminRegionsController,
  RegionsController,
} from './regions.controller';
import { RegionsService } from './regions.service';
import { UpdateRegionDto } from './dto/update-region.dto';

const regionId = '11111111-1111-4111-8111-111111111111';
const actorId = '22222222-2222-4222-8222-222222222222';
const timestamp = new Date('2026-09-29T00:00:00Z');
const source: Region = {
  id: regionId,
  name: 'Canonical Region',
  slug: 'canonical-region',
  description: 'Canonical editorial prose.',
  status: LocationStatus.ACTIVE,
  createdAt: timestamp,
  updatedAt: timestamp,
};
const editorial: PublicRegionEditorialTranslation = {
  locale: EditorialLocale.am,
  displayName: 'ደቡብ ኢትዮጵያ',
  description: 'የክልሉ መግለጫ።',
  isPublished: true,
};
const adminTranslation = {
  ...editorial,
  publishedAt: timestamp,
  updatedAt: timestamp,
};

function fixture() {
  const region = {
    findUnique: jest.fn<Promise<Region | null>, [Prisma.RegionFindUniqueArgs]>(
      (args) => Promise.resolve(args.where.slug ? null : source),
    ),
    findFirst: jest.fn<
      Promise<
        (Region & { translations: PublicRegionEditorialTranslation[] }) | null
      >,
      [unknown]
    >(() => Promise.resolve({ ...source, translations: [editorial] })),
    findMany: jest.fn(() =>
      Promise.resolve([{ ...source, translations: [editorial] }]),
    ),
    count: jest.fn(() => Promise.resolve(1)),
    update: jest.fn(() => Promise.resolve(source)),
  };
  const regionTranslation = {
    findUnique: jest.fn<Promise<typeof adminTranslation | null>, [unknown]>(
      () => Promise.resolve(adminTranslation),
    ),
    upsert: jest.fn(() =>
      Promise.resolve({
        ...adminTranslation,
        isPublished: false,
        publishedAt: null,
      }),
    ),
    update: jest.fn<
      Promise<typeof adminTranslation>,
      [Prisma.RegionTranslationUpdateArgs]
    >(() => Promise.resolve(adminTranslation)),
    findMany: jest.fn(() => Promise.resolve([{ locale: EditorialLocale.am }])),
    updateMany: jest.fn(() => Promise.resolve({ count: 1 })),
  };
  const tx = {
    region,
    regionTranslation,
    $queryRaw: jest.fn<Promise<Array<{ id: string }>>, [Prisma.Sql]>(() =>
      Promise.resolve([{ id: regionId }]),
    ),
  };
  const client = {
    ...tx,
    $transaction: jest.fn(
      async (
        work:
          | readonly Promise<unknown>[]
          | ((value: typeof tx) => Promise<unknown>),
      ): Promise<unknown> =>
        typeof work === 'function' ? work(tx) : Promise.all(work),
    ),
  };
  const record = jest.fn<Promise<void>, [Prisma.TransactionClient, AuditWrite]>(
    () => Promise.resolve(),
  );
  const service = new RegionsService(
    client as unknown as PrismaService,
    { record } as unknown as AuditService,
  );
  return { client, tx, record, service };
}

describe('G1A Region editorial resolver and DTOs (no database)', () => {
  it('the create-only SQL adds only Region translation infrastructure', () => {
    const sql = readFileSync(
      resolve(
        __dirname,
        '../../prisma/migrations/20260929000001_region_translations/migration.sql',
      ),
      'utf8',
    );
    expect(sql).toContain('CREATE TABLE "region_translations"');
    expect(sql).toContain('"locale" "EditorialLocale" NOT NULL');
    expect(sql).toContain('"id" UUID NOT NULL');
    expect(sql).toContain('PRIMARY KEY ("id")');
    expect(sql).toContain('("region_id", "locale")');
    expect(sql).toContain('("locale", "is_published")');
    expect(sql).toContain('REFERENCES "regions"("id") ON DELETE RESTRICT');
    expect(sql).not.toMatch(
      /^\s*(?:DROP|INSERT|DELETE|UPDATE|CREATE EXTENSION|CREATE TYPE)\b/m,
    );
    expect(sql.match(/CREATE TABLE/g)).toHaveLength(1);
    expect(sql.match(/ALTER TABLE/g)).toHaveLength(1);
    expect(sql).toContain('ALTER TABLE "region_translations"');
  });
  it.each([undefined, EditorialLocale.en])(
    'uses the complete source for locale %s',
    (locale) => {
      expect(resolvePublicRegionEditorial(source, locale, editorial)).toBe(
        source,
      );
    },
  );

  it('uses complete published Amharic without changing canonical identity', () => {
    expect(
      resolvePublicRegionEditorial(source, EditorialLocale.am, editorial),
    ).toEqual({
      ...source,
      name: editorial.displayName,
      description: editorial.description,
    });
  });

  it.each([
    undefined,
    { ...editorial, isPublished: false },
    { ...editorial, displayName: ' \u00a0\t\n' },
    { ...editorial, description: ' \u00a0\t\n' },
    { ...editorial, locale: EditorialLocale.en },
  ])('falls back as a whole for an ineligible translation %#', (candidate) => {
    expect(
      resolvePublicRegionEditorial(source, EditorialLocale.am, candidate),
    ).toBe(source);
  });

  it.each([null, '', ' \u00a0\t'])(
    'allows name-only publication when source prose is %s',
    (description) => {
      const canonical = { ...source, description };
      const nameOnly = { ...editorial, description: null };
      expect(isRegionTranslationComplete(canonical, nameOnly)).toBe(true);
      expect(
        resolvePublicRegionEditorial(canonical, EditorialLocale.am, nameOnly),
      ).toEqual({
        ...canonical,
        name: editorial.displayName,
        description: null,
      });
    },
  );

  it('may display approved optional translated prose when source prose is absent', () => {
    expect(
      resolvePublicRegionEditorial(
        { ...source, description: null },
        EditorialLocale.am,
        editorial,
      ).description,
    ).toBe(editorial.description);
  });

  it('trims drafts, normalizes whitespace to null, and accepts incomplete drafts', () => {
    const dto = plainToInstance(UpsertRegionTranslationDto, {
      displayName: '  ክልል  ',
      description: ' \u00a0\n',
    });
    expect(dto).toEqual({ displayName: 'ክልል', description: null });
    expect(validateSync(dto)).toEqual([]);
    expect(validateSync(new UpsertRegionTranslationDto())).toEqual([]);
  });

  it.each([
    { displayName: 'x'.repeat(161) },
    { description: 'x'.repeat(5001) },
    { displayName: 12 },
    { description: [] },
    ...[
      'id',
      'regionId',
      'slug',
      'status',
      'locale',
      'isPublished',
      'publishedAt',
      'createdAt',
      'updatedAt',
    ].map((key) => ({ [key]: 'blocked' })),
  ])('rejects invalid or non-allowlisted draft fields %#', (input) => {
    expect(
      validateSync(plainToInstance(UpsertRegionTranslationDto, input), {
        whitelist: true,
        forbidNonWhitelisted: true,
      }).length,
    ).toBeGreaterThan(0);
  });

  it('accepts the exact field length limits', () => {
    expect(
      validateSync(
        plainToInstance(UpsertRegionTranslationDto, {
          displayName: 'x'.repeat(160),
          description: 'x'.repeat(5000),
        }),
      ),
    ).toEqual([]);
  });

  it.each(['fr', 'AM', 'amh', '', ['en', 'am']])(
    'rejects explicit invalid locale %s',
    (locale) => {
      for (const Type of [PublicRegionQueryDto, RegionLocaleQueryDto]) {
        expect(
          validateSync(plainToInstance(Type, { locale })).length,
        ).toBeGreaterThan(0);
      }
    },
  );
});

describe('G1A Region translation service (mocked transactions)', () => {
  it.each([undefined, EditorialLocale.en, EditorialLocale.am])(
    'keeps public lists bounded and eligible for locale %s',
    async (locale) => {
      const { service, client } = fixture();
      const result = await service.findPublic({
        locale,
        page: 2,
        limit: 20,
        q: 'Canonical',
      });
      expect(client.region.findMany).toHaveBeenCalledWith({
        where: {
          status: LocationStatus.ACTIVE,
          name: { contains: 'Canonical', mode: 'insensitive' },
        },
        select:
          locale === EditorialLocale.am
            ? localizedPublicRegionSelect
            : publicRegionSelect,
        orderBy: { name: 'asc' },
        skip: 20,
        take: 20,
      });
      expect(client.region.count).toHaveBeenCalledWith({
        where: {
          status: LocationStatus.ACTIVE,
          name: { contains: 'Canonical', mode: 'insensitive' },
        },
      });
      expect(result.data[0]?.name).toBe(
        locale === EditorialLocale.am ? editorial.displayName : source.name,
      );
      expect(result.meta.total).toBe(1);
      expect(client.regionTranslation.findUnique).not.toHaveBeenCalled();
      expect(JSON.stringify(result)).not.toMatch(
        /translations|isPublished|publishedAt|displayName/,
      );
    },
  );

  it('loads a scoped active Region with an explicit projection, not translated slug matching', async () => {
    const { service, client } = fixture();
    const result = await service.findPublicBySlug(
      source.slug,
      EditorialLocale.am,
    );
    expect(client.region.findFirst).toHaveBeenCalledWith({
      where: { slug: source.slug, status: LocationStatus.ACTIVE },
      select: localizedPublicRegionSelect,
    });
    expect(result.slug).toBe(source.slug);
    expect(result.id).toBe(regionId);
    expect(JSON.stringify(result)).not.toMatch(
      /translations|isPublished|publishedAt|displayName/,
    );
  });

  it('returns 404 for an absent/ineligible public Region', async () => {
    const { service, client } = fixture();
    // The explicit ACTIVE predicate is asserted above; the DB enforces it in G1B.
    client.region.findFirst.mockResolvedValueOnce(null);
    await expect(
      service.findPublicBySlug('hidden', EditorialLocale.am),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('saves a normalized unpublished draft with route-derived identity and transactional audit', async () => {
    const { service, tx, record } = fixture();
    await service.saveTranslation(
      regionId,
      EditorialLocale.am,
      actorId,
      { displayName: '  ክልል  ', description: '  ' },
      {},
    );
    expect(tx.regionTranslation.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { regionId_locale: { regionId, locale: EditorialLocale.am } },
        create: {
          regionId,
          locale: EditorialLocale.am,
          displayName: 'ክልል',
          description: null,
          isPublished: false,
          publishedAt: null,
        },
        update: {
          displayName: 'ክልል',
          description: null,
          isPublished: false,
          publishedAt: null,
        },
      }),
    );
    expect(record).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        action: AUDIT_ACTIONS.ADMIN_REGION_TRANSLATION_SAVED,
        actorUserId: actorId,
        entityType: AUDIT_ENTITY_TYPES.REGION,
        metadata: { regionId, locale: EditorialLocale.am },
      }),
    );
    expect(JSON.stringify(record.mock.calls)).not.toContain('ክልል');
  });

  it.each([
    LocationStatus.ACTIVE,
    LocationStatus.DRAFT,
    LocationStatus.INACTIVE,
  ])(
    'permits complete translation publication for %s without exposing the parent',
    async (status) => {
      const { service, tx, record } = fixture();
      tx.region.findUnique.mockResolvedValueOnce({ ...source, status });
      await service.publishTranslation(
        regionId,
        EditorialLocale.am,
        actorId,
        {},
      );
      const write = tx.regionTranslation.update.mock.calls[0]?.[0];
      expect(write?.data.isPublished).toBe(true);
      expect(write?.data.publishedAt).toBeInstanceOf(Date);
      expect(record).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({
          action: AUDIT_ACTIONS.ADMIN_REGION_TRANSLATION_PUBLISHED,
        }),
      );
    },
  );

  it.each([
    { ...adminTranslation, displayName: null },
    { ...adminTranslation, displayName: '\u00a0 ' },
    { ...adminTranslation, description: null },
  ])(
    'rejects incomplete publication %# without writing/auditing success',
    async (translation) => {
      const { service, tx, record } = fixture();
      tx.regionTranslation.findUnique.mockResolvedValueOnce(translation);
      await expect(
        service.publishTranslation(regionId, EditorialLocale.am, actorId, {}),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(tx.regionTranslation.update).not.toHaveBeenCalled();
      expect(record).not.toHaveBeenCalled();
    },
  );

  it('publishes display-name-only when source description is null', async () => {
    const { service, tx } = fixture();
    tx.region.findUnique.mockResolvedValueOnce({
      ...source,
      description: null,
    });
    tx.regionTranslation.findUnique.mockResolvedValueOnce({
      ...adminTranslation,
      description: null,
    });
    await service.publishTranslation(regionId, EditorialLocale.am, actorId, {});
    expect(tx.regionTranslation.update).toHaveBeenCalled();
  });

  it.each(['save', 'publish'] as const)(
    'rejects %s on archived Regions',
    async (operation) => {
      const { service, tx, record } = fixture();
      tx.region.findUnique.mockResolvedValueOnce({
        ...source,
        status: LocationStatus.ARCHIVED,
      });
      const work =
        operation === 'save'
          ? service.saveTranslation(
              regionId,
              EditorialLocale.am,
              actorId,
              {},
              {},
            )
          : service.publishTranslation(
              regionId,
              EditorialLocale.am,
              actorId,
              {},
            );
      await expect(work).rejects.toBeInstanceOf(ConflictException);
      expect(tx.regionTranslation.upsert).not.toHaveBeenCalled();
      expect(tx.regionTranslation.update).not.toHaveBeenCalled();
      expect(record).not.toHaveBeenCalled();
    },
  );

  it('allows archived reads and repeated unpublish while preserving prose', async () => {
    const { service, tx, record } = fixture();
    tx.region.findUnique.mockResolvedValue({
      ...source,
      status: LocationStatus.ARCHIVED,
    });
    await service.findTranslation(regionId, EditorialLocale.am);
    await service.unpublishTranslation(
      regionId,
      EditorialLocale.am,
      actorId,
      {},
    );
    await service.unpublishTranslation(
      regionId,
      EditorialLocale.am,
      actorId,
      {},
    );
    expect(tx.regionTranslation.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: { isPublished: false, publishedAt: null },
      }),
    );
    expect(record).toHaveBeenCalledTimes(2);
  });

  it.each(['read', 'publish', 'unpublish'] as const)(
    'returns 404 for missing translation during %s',
    async (operation) => {
      const { service, tx } = fixture();
      tx.regionTranslation.findUnique.mockResolvedValue(null);
      const work =
        operation === 'read'
          ? service.findTranslation(regionId, EditorialLocale.am)
          : operation === 'publish'
            ? service.publishTranslation(
                regionId,
                EditorialLocale.am,
                actorId,
                {},
              )
            : service.unpublishTranslation(
                regionId,
                EditorialLocale.am,
                actorId,
                {},
              );
      await expect(work).rejects.toBeInstanceOf(NotFoundException);
    },
  );

  it('rejects English management on all lifecycle operations before touching the database', async () => {
    const { service, client } = fixture();
    for (const work of [
      () => service.findTranslation(regionId, EditorialLocale.en),
      () =>
        service.saveTranslation(regionId, EditorialLocale.en, actorId, {}, {}),
      () =>
        service.publishTranslation(regionId, EditorialLocale.en, actorId, {}),
      () =>
        service.unpublishTranslation(regionId, EditorialLocale.en, actorId, {}),
    ])
      await expect(work()).rejects.toBeInstanceOf(BadRequestException);
    expect(client.$transaction).not.toHaveBeenCalled();
    expect(client.region.findUnique).not.toHaveBeenCalled();
  });

  it.each([
    { name: 'Changed source', slug: source.slug },
    { description: 'Changed source prose' },
    plainToInstance(UpdateRegionDto, { description: null }),
  ])(
    'invalidates published translations atomically on an actual source change %#',
    async (dto) => {
      const { service, tx, record } = fixture();
      await service.update(regionId, dto, actorId, {});
      expect(tx.regionTranslation.updateMany).toHaveBeenCalledWith({
        where: { regionId, isPublished: true },
        data: { isPublished: false, publishedAt: null },
      });
      expect(record).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({
          action: AUDIT_ACTIONS.ADMIN_REGION_TRANSLATION_INVALIDATED,
          reason: 'source_changed',
          metadata: {
            regionId,
            locale: EditorialLocale.am,
            operation: 'source_changed',
            previousStatus: 'PUBLISHED',
            nextStatus: 'DRAFT',
          },
        }),
      );
      expect(JSON.stringify(record.mock.calls)).not.toContain('Changed source');
    },
  );

  it.each([
    { name: source.name },
    { description: source.description! },
    { status: LocationStatus.INACTIVE },
    { slug: 'explicit-source-slug' },
    {},
  ])(
    'does not invalidate for resubmitted or unrelated fields %#',
    async (dto) => {
      const { service, tx, record } = fixture();
      await service.update(regionId, dto, actorId, {});
      expect(tx.regionTranslation.findMany).not.toHaveBeenCalled();
      expect(tx.regionTranslation.updateMany).not.toHaveBeenCalled();
      expect(record).not.toHaveBeenCalled();
    },
  );

  it('preserves canonical name/slug generation without invalidating absent published rows', async () => {
    const { service, tx, record } = fixture();
    tx.regionTranslation.findMany.mockResolvedValueOnce([]);
    await service.update(regionId, { name: 'Changed Region' }, actorId, {});
    expect(tx.region.update).toHaveBeenCalledWith({
      where: { id: regionId },
      data: { name: 'Changed Region', slug: 'changed-region' },
    });
    expect(tx.regionTranslation.updateMany).not.toHaveBeenCalled();
    expect(record).not.toHaveBeenCalled();
  });

  it('does not invalidate when a null source description is resubmitted as null', async () => {
    const { service, tx, record } = fixture();
    tx.region.findUnique.mockResolvedValueOnce({
      ...source,
      description: null,
    });
    await service.update(
      regionId,
      plainToInstance(UpdateRegionDto, { description: null }),
      actorId,
      {},
    );
    expect(tx.regionTranslation.updateMany).not.toHaveBeenCalled();
    expect(record).not.toHaveBeenCalled();
  });

  it('locks the same parent with a bound UUID before publication and source edits', async () => {
    const { service, tx } = fixture();
    await service.publishTranslation(regionId, EditorialLocale.am, actorId, {});
    await service.update(regionId, { description: 'New prose' }, actorId, {});
    expect(tx.$queryRaw).toHaveBeenCalledTimes(2);
    for (const [sql] of tx.$queryRaw.mock.calls) {
      expect(sql.values).toEqual([regionId]);
      expect(sql.text).toContain('FOR UPDATE');
      expect(sql.text).not.toContain(regionId);
    }
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.region.findUnique.mock.invocationCallOrder[0]!,
    );
  });

  it('propagates audit failure instead of returning a successful mutation', async () => {
    const { service, record } = fixture();
    record.mockRejectedValueOnce(new Error('audit unavailable'));
    await expect(
      service.saveTranslation(regionId, EditorialLocale.am, actorId, {}, {}),
    ).rejects.toThrow('audit unavailable');
    // Actual DB rollback and concurrent lock behavior are explicitly deferred to G1B.
  });

  it('passes only necessary translation fields to Admin serialization', async () => {
    const { service, tx } = fixture();
    await service.findTranslation(regionId, EditorialLocale.am);
    expect(tx.regionTranslation.findUnique).toHaveBeenCalledWith({
      where: { regionId_locale: { regionId, locale: EditorialLocale.am } },
      select: {
        locale: true,
        displayName: true,
        description: true,
        isPublished: true,
        publishedAt: true,
        updatedAt: true,
      },
    });
  });

  it('the real audit allowlist retains safe Region metadata but strips editorial fields', async () => {
    const create = jest.fn<Promise<unknown>, [Prisma.AuditLogCreateArgs]>(() =>
      Promise.resolve({}),
    );
    const client = { auditLog: { create } };
    const audit = new AuditService(client as unknown as PrismaService);
    await audit.record(client as unknown as Prisma.TransactionClient, {
      action: AUDIT_ACTIONS.ADMIN_REGION_TRANSLATION_SAVED,
      entityType: AUDIT_ENTITY_TYPES.REGION,
      metadata: {
        regionId,
        locale: EditorialLocale.am,
        displayName: 'private editorial',
        description: 'private prose',
      },
    });
    expect(create.mock.calls[0]?.[0].data.metadata).toEqual({
      regionId,
      locale: EditorialLocale.am,
    });
    expect(JSON.stringify(create.mock.calls)).not.toContain('private');
  });
});

describe('G1A Region HTTP validation and authorization (mocked persistence)', () => {
  let app: INestApplication;
  let server: Server;
  let f: ReturnType<typeof fixture>;
  let roles = ['ADMIN'];
  let authenticated = true;

  class TestJwtGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
      if (!authenticated) throw new UnauthorizedException();
      const user: AuthenticatedUser = {
        sub: actorId,
        roles,
        sessionId: regionId,
        email: 'admin@example.test',
      };
      context.switchToHttp().getRequest<{ user: AuthenticatedUser }>().user =
        user;
      return true;
    }
  }

  beforeEach(async () => {
    f = fixture();
    roles = ['ADMIN'];
    authenticated = true;
    const module = await Test.createTestingModule({
      controllers: [RegionsController, AdminRegionsController],
      providers: [{ provide: RegionsService, useValue: f.service }],
    })
      .overrideGuard(JwtAuthGuard)
      .useClass(TestJwtGuard)
      .compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
    server = app.getHttpServer() as Server;
  });
  afterEach(async () => {
    await app?.close();
  });

  it('renders English default and Amharic list/detail through the real service', async () => {
    await request(server)
      .get('/api/v1/regions')
      .expect(200)
      .expect(({ body }: { body: { data: Region[] } }) => {
        expect(body.data[0]?.name).toBe(source.name);
      });
    await request(server).get('/api/v1/regions?locale=en').expect(200);
    await request(server)
      .get('/api/v1/regions?locale=am')
      .expect(200)
      .expect(({ body }: { body: { data: Region[] } }) => {
        expect(body.data[0]?.name).toBe(editorial.displayName);
        expect(JSON.stringify(body)).not.toMatch(
          /translations|isPublished|publishedAt/,
        );
      });
    await request(server)
      .get(`/api/v1/regions/${source.slug}?locale=am`)
      .expect(200)
      .expect(({ body }: { body: Region }) => {
        expect(body.slug).toBe(source.slug);
        expect(body.name).toBe(editorial.displayName);
      });
  });

  it.each(['fr', 'AM', 'amh', ''])(
    'rejects invalid public locale %s on list/detail',
    async (locale) => {
      await request(server).get(`/api/v1/regions?locale=${locale}`).expect(400);
      await request(server)
        .get(`/api/v1/regions/${source.slug}?locale=${locale}`)
        .expect(400);
      expect(f.client.region.findMany).not.toHaveBeenCalled();
    },
  );

  it('keeps existing pagination validation and rejects unknown queries', async () => {
    for (const query of ['page=0', 'limit=0', 'limit=101', 'unexpected=true']) {
      await request(server).get(`/api/v1/regions?${query}`).expect(400);
    }
  });

  it('supports all ADMIN lifecycle endpoints and keeps source PATCH actor context', async () => {
    const path = `/api/v1/admin/regions/${regionId}/translations/am`;
    await request(server).get(path).expect(200);
    await request(server)
      .put(path)
      .send({ displayName: '  ክልል  ', description: '  ' })
      .expect(200);
    await request(server).post(`${path}/publish`).expect(200);
    await request(server).post(`${path}/unpublish`).expect(200);
    await request(server)
      .patch(`/api/v1/admin/regions/${regionId}`)
      .send({ description: 'New source' })
      .expect(200);
    expect(f.record).toHaveBeenLastCalledWith(
      f.tx,
      expect.objectContaining({
        actorUserId: actorId,
        action: AUDIT_ACTIONS.ADMIN_REGION_TRANSLATION_INVALIDATED,
      }),
    );
  });

  it.each(['TRAVELER', 'BUSINESS_OWNER', 'BUSINESS_STAFF'])(
    'denies %s access to every translation endpoint',
    async (role) => {
      roles = [role];
      const path = `/api/v1/admin/regions/${regionId}/translations/am`;
      await request(server).get(path).expect(403);
      await request(server)
        .put(path)
        .send({ displayName: 'blocked' })
        .expect(403);
      await request(server).post(`${path}/publish`).expect(403);
      await request(server).post(`${path}/unpublish`).expect(403);
      expect(f.client.$transaction).not.toHaveBeenCalled();
    },
  );

  it('denies unauthenticated access to every translation endpoint', async () => {
    authenticated = false;
    const path = `/api/v1/admin/regions/${regionId}/translations/am`;
    await request(server).get(path).expect(401);
    await request(server).put(path).send({}).expect(401);
    await request(server).post(`${path}/publish`).expect(401);
    await request(server).post(`${path}/unpublish`).expect(401);
  });

  it('rejects invalid UUIDs and unsupported/English managed locales', async () => {
    for (const suffix of [
      'not-a-uuid/translations/am',
      `${regionId}/translations/fr`,
      `${regionId}/translations/en`,
    ]) {
      await request(server).get(`/api/v1/admin/regions/${suffix}`).expect(400);
    }
  });

  it('rejects mass assignment, oversized fields, and nonempty lifecycle bodies', async () => {
    const path = `/api/v1/admin/regions/${regionId}/translations/am`;
    for (const body of [
      { slug: 'blocked' },
      { locale: 'en' },
      { isPublished: true },
      { displayName: 'x'.repeat(161) },
      { description: 'x'.repeat(5001) },
    ])
      await request(server).put(path).send(body).expect(400);
    await request(server)
      .post(`${path}/publish`)
      .send({ isPublished: true })
      .expect(400);
    await request(server)
      .post(`${path}/unpublish`)
      .send({ description: 'blocked' })
      .expect(400);
    expect(f.record).not.toHaveBeenCalled();
  });

  it('rejects a non-object draft body', async () => {
    const path = `/api/v1/admin/regions/${regionId}/translations/am`;
    await request(server).put(path).send([]).expect(400);
    await request(server).post(`${path}/publish`).send([]).expect(400);
    await request(server).post(`${path}/unpublish`).send([]).expect(400);
    expect(f.record).not.toHaveBeenCalled();
  });
});
