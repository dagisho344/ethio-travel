import { randomUUID } from 'node:crypto';
import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  EditorialLocale,
  LocationStatus,
  Prisma,
  PrismaClient,
} from '@prisma/client';
import type { Server } from 'node:http';
import request from 'supertest';
import { AuditService } from '../src/audit/audit.service';
import { AuthenticatedUser } from '../src/auth/authenticated-user';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  AdminRegionsController,
  RegionsController,
} from '../src/regions/regions.controller';
import { RegionsService } from '../src/regions/regions.service';

// Reuses the existing discovery database-test opt-in. Every fixture transaction
// is rolled back, including Region, RegionTranslation and AuditLog records.
const databaseDescribe =
  process.env.DISCOVERY_DATABASE_TESTS === '1' ? describe : describe.skip;
const rollback = new Error('Rollback Region translation fixtures');

function responseBody(response: request.Response): Record<string, unknown> {
  const body: unknown = response.body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new Error('Expected an object response body.');
  }
  return body as Record<string, unknown>;
}

let roles: string[] = ['ADMIN'];
let authenticated = true;
let actorUserId = '';
class TestJwtGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    if (!authenticated) throw new UnauthorizedException();
    const user: AuthenticatedUser = {
      sub: actorUserId,
      email: 'region-test@example.com',
      roles,
      sessionId: randomUUID(),
    };
    context.switchToHttp().getRequest<{ user: AuthenticatedUser }>().user =
      user;
    return true;
  }
}

type TransactionFixture = {
  tx: Prisma.TransactionClient;
  regionId: string;
  slug: string;
  service: RegionsService;
  audit: AuditService;
  server: Server;
};

databaseDescribe('Region translations against migrated PostgreSQL', () => {
  const prisma = new PrismaClient();
  afterAll(async () => prisma.$disconnect());

  async function withFixture(
    run: (fixture: TransactionFixture) => Promise<void>,
    description: string | null = 'Canonical source description',
  ) {
    const id = randomUUID();
    let app: INestApplication | undefined;
    try {
      await prisma.$transaction(
        async (tx) => {
          const region = await tx.region.create({
            data: {
              id,
              name: 'G1B Source Region',
              slug: `g1b-${id}`,
              description,
              status: LocationStatus.ACTIVE,
            },
          });
          const actor = await tx.user.create({
            data: {
              email: `g1b-${id}@example.invalid`,
              passwordHash: 'not-a-real-login-secret',
            },
          });
          actorUserId = actor.id;
          const adapter = {
            region: tx.region,
            regionTranslation: tx.regionTranslation,
            auditLog: tx.auditLog,
            $transaction: (
              operation:
                | Prisma.PrismaPromise<unknown>[]
                | ((client: Prisma.TransactionClient) => Promise<unknown>),
            ) =>
              Array.isArray(operation) ? Promise.all(operation) : operation(tx),
          } as unknown as PrismaService;
          const moduleRef = await Test.createTestingModule({
            controllers: [RegionsController, AdminRegionsController],
            providers: [
              RegionsService,
              AuditService,
              { provide: PrismaService, useValue: adapter },
            ],
          })
            .overrideGuard(JwtAuthGuard)
            .useClass(TestJwtGuard)
            .compile();
          app = moduleRef.createNestApplication();
          app.setGlobalPrefix('api/v1');
          app.useGlobalPipes(
            new ValidationPipe({
              transform: true,
              whitelist: true,
              forbidNonWhitelisted: true,
            }),
          );
          await app.init();
          const fixture: TransactionFixture = {
            tx,
            regionId: region.id,
            slug: region.slug,
            service: app.get(RegionsService),
            audit: app.get(AuditService),
            server: app.getHttpServer() as Server,
          };
          roles = ['ADMIN'];
          authenticated = true;
          await run(fixture);
          throw rollback;
        },
        { timeout: 60_000 },
      );
    } catch (error) {
      if (error !== rollback) throw error;
    } finally {
      await app?.close();
    }
    expect(await prisma.region.count({ where: { id } })).toBe(0);
    expect(await prisma.user.count({ where: { id: actorUserId } })).toBe(0);
    expect(
      await prisma.regionTranslation.count({ where: { regionId: id } }),
    ).toBe(0);
    expect(
      await prisma.auditLog.count({
        where: { entityId: id, entityType: 'REGION' },
      }),
    ).toBe(0);
  }

  it('serves canonical English and an eligible published Amharic representation without internals', async () => {
    await withFixture(async ({ regionId, slug, service, server, tx }) => {
      const base = `/api/v1/regions/${slug}`;
      for (const suffix of ['', '?locale=en', '?locale=am']) {
        const response = await request(server)
          .get(`${base}${suffix}`)
          .expect(200);
        expect(responseBody(response)).toMatchObject({
          id: regionId,
          slug,
          name: 'G1B Source Region',
          description: 'Canonical source description',
        });
      }
      await request(server)
        .put(`/api/v1/admin/regions/${regionId}/translations/am`)
        .send({ displayName: 'የክልል ስም', description: 'የክልል መግለጫ' })
        .expect(200);
      expect(await tx.regionTranslation.count({ where: { regionId } })).toBe(1);
      await request(server)
        .post(`/api/v1/admin/regions/${regionId}/translations/am/publish`)
        .send({})
        .expect(200);
      const localized = await request(server)
        .get(`${base}?locale=am`)
        .expect(200);
      expect(responseBody(localized)).toMatchObject({
        id: regionId,
        slug,
        name: 'የክልል ስም',
        description: 'የክልል መግለጫ',
      });
      for (const key of [
        'translations',
        'isPublished',
        'publishedAt',
        'locale',
      ]) {
        expect(responseBody(localized)).not.toHaveProperty(key);
      }
      const list = await request(server)
        .get('/api/v1/regions?locale=am')
        .expect(200);
      const listBody = responseBody(list);
      expect(listBody.data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: regionId, name: 'የክልል ስም' }),
        ]),
      );
      if (!Array.isArray(listBody.data))
        throw new Error('Expected Region list.');
      for (const item of listBody.data as unknown[]) {
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
          throw new Error('Expected Region list item.');
        }
        const record = item as Record<string, unknown>;
        if (record.id === regionId)
          expect(record).not.toHaveProperty('translations');
      }
      expect(
        (await service.findPublicBySlug(slug, EditorialLocale.en)).name,
      ).toBe('G1B Source Region');
    });
  });

  it('keeps draft, incomplete and unpublished content entirely out of public responses', async () => {
    await withFixture(async ({ regionId, slug, server }) => {
      const admin = `/api/v1/admin/regions/${regionId}/translations/am`;
      const publicUrl = `/api/v1/regions/${slug}?locale=am`;
      await request(server)
        .put(admin)
        .send({ displayName: 'የክልል ስም' })
        .expect(200);
      await request(server).post(`${admin}/publish`).send({}).expect(400);
      expect(
        responseBody(await request(server).get(publicUrl).expect(200)).name,
      ).toBe('G1B Source Region');
      await request(server)
        .put(admin)
        .send({ description: 'የክልል መግለጫ' })
        .expect(200);
      expect(
        responseBody(await request(server).get(publicUrl).expect(200))
          .description,
      ).toBe('Canonical source description');
      const published = await request(server)
        .post(`${admin}/publish`)
        .send({})
        .expect(200);
      expect(responseBody(published).isPublished).toBe(true);
      expect(responseBody(published).publishedAt).toBeTruthy();
      await request(server).post(`${admin}/unpublish`).send({}).expect(200);
      expect(
        responseBody(await request(server).get(publicUrl).expect(200)).name,
      ).toBe('G1B Source Region');
      const draft = await request(server)
        .put(admin)
        .send({ description: 'አዲስ ረቂቅ' })
        .expect(200);
      expect(responseBody(draft)).toMatchObject({
        isPublished: false,
        publishedAt: null,
        description: 'አዲስ ረቂቅ',
      });
    });
  });

  it('allows translated name alone when canonical description is absent', async () => {
    await withFixture(async ({ regionId, slug, server }) => {
      const admin = `/api/v1/admin/regions/${regionId}/translations/am`;
      await request(server).put(admin).send({ displayName: 'ክልል' }).expect(200);
      await request(server).post(`${admin}/publish`).send({}).expect(200);
      expect(
        responseBody(
          await request(server)
            .get(`/api/v1/regions/${slug}?locale=am`)
            .expect(200),
        ),
      ).toMatchObject({ name: 'ክልል', description: null });
    }, null);
  });

  it('rejects invalid locales, unauthorized users and mass assignment on live HTTP routes', async () => {
    await withFixture(async ({ regionId, server }) => {
      const base = `/api/v1/admin/regions/${regionId}/translations/am`;
      for (const value of ['fr', 'AM', 'amh', '']) {
        await request(server)
          .get(`/api/v1/regions?locale=${value}`)
          .expect(400);
      }
      await request(server)
        .get(`/api/v1/regions/${regionId}?locale=fr`)
        .expect(400);
      await request(server)
        .get(`/api/v1/admin/regions/not-a-uuid/translations/am`)
        .expect(400);
      await request(server).put(base).send({ slug: 'illegal' }).expect(400);
      await request(server).put(base).send({ status: 'ACTIVE' }).expect(400);
      await request(server).put(base).send({ id: regionId }).expect(400);
      await request(server)
        .put(base)
        .send({ displayName: 'x'.repeat(161) })
        .expect(400);
      await request(server)
        .put(base)
        .send({ description: 'x'.repeat(5001) })
        .expect(400);
      await request(server)
        .put(`/api/v1/admin/regions/${regionId}/translations/en`)
        .send({ displayName: 'English' })
        .expect(400);
      roles = ['TRAVELER'];
      await request(server).put(base).send({ displayName: 'ክልል' }).expect(403);
      authenticated = false;
      await request(server).put(base).send({ displayName: 'ክልል' }).expect(401);
    });
  });

  it('enforces status and source-change invalidation with persisted, prose-free audits', async () => {
    await withFixture(async ({ regionId, server, service, tx }) => {
      const admin = `/api/v1/admin/regions/${regionId}/translations/am`;
      await request(server)
        .put(admin)
        .send({ displayName: 'የክልል ስም', description: 'የክልል መግለጫ' })
        .expect(200);
      await request(server).post(`${admin}/publish`).send({}).expect(200);
      const unchangedNameUpdate = await service.update(regionId, {
        name: 'G1B Source Region',
      });
      // Existing canonical Region editing regenerates the slug whenever a
      // name is submitted, even if the name is unchanged. Translation
      // publication must remain intact; subsequent requests use that slug.
      const currentSlug = unchangedNameUpdate.slug;
      expect(
        (await tx.regionTranslation.findFirstOrThrow({ where: { regionId } }))
          .isPublished,
      ).toBe(true);
      await service.update(regionId, { status: LocationStatus.DRAFT });
      await request(server)
        .get(`/api/v1/regions/${currentSlug}?locale=am`)
        .expect(404);
      await request(server).get(admin).expect(200);
      await service.update(regionId, { status: LocationStatus.ACTIVE });
      await service.update(regionId, {
        description: 'Changed canonical prose',
      });
      const invalidated = await tx.regionTranslation.findFirstOrThrow({
        where: { regionId },
      });
      expect(invalidated).toMatchObject({
        isPublished: false,
        publishedAt: null,
        displayName: 'የክልል ስም',
      });
      expect(
        responseBody(
          await request(server)
            .get(`/api/v1/regions/${currentSlug}?locale=am`)
            .expect(200),
        ).name,
      ).toBe('G1B Source Region');
      await request(server).post(`${admin}/publish`).send({}).expect(200);
      await service.update(regionId, { status: LocationStatus.ARCHIVED });
      await request(server).get(admin).expect(200);
      await request(server).post(`${admin}/unpublish`).send({}).expect(200);
      await request(server).put(admin).send({ displayName: 'አዲስ' }).expect(409);
      await request(server).post(`${admin}/publish`).send({}).expect(409);
      const logs = await tx.auditLog.findMany({
        where: { entityId: regionId, entityType: 'REGION' },
        orderBy: { createdAt: 'asc' },
      });
      expect(logs.map((log) => log.action)).toEqual(
        expect.arrayContaining([
          'ADMIN_REGION_TRANSLATION_SAVED',
          'ADMIN_REGION_TRANSLATION_PUBLISHED',
          'ADMIN_REGION_TRANSLATION_INVALIDATED',
          'ADMIN_REGION_TRANSLATION_UNPUBLISHED',
        ]),
      );
      expect(
        logs.find(
          (log) => log.action === 'ADMIN_REGION_TRANSLATION_INVALIDATED',
        )?.reason,
      ).toBe('source_changed');
      for (const log of logs) {
        const serialized = JSON.stringify(log.metadata);
        expect(serialized).not.toContain('የክልል');
        expect(serialized).not.toContain('Changed canonical prose');
        expect(serialized).not.toContain('Canonical source description');
      }
    });
  });

  it('rolls back a real service transaction when audit persistence fails', async () => {
    const id = randomUUID();
    const audit = new AuditService(prisma as unknown as PrismaService);
    const service = new RegionsService(
      prisma as unknown as PrismaService,
      audit,
    );
    await prisma.region.create({
      data: { id, name: 'G1B Audit Rollback', slug: `g1b-${id}` },
    });
    try {
      const spy = jest
        .spyOn(audit, 'record')
        .mockRejectedValueOnce(new Error('audit write failed'));
      await expect(
        service.saveTranslation(
          id,
          EditorialLocale.am,
          randomUUID(),
          { displayName: 'ክልል' },
          {},
        ),
      ).rejects.toThrow('audit write failed');
      spy.mockRestore();
      expect(
        await prisma.regionTranslation.count({ where: { regionId: id } }),
      ).toBe(0);
    } finally {
      await prisma.region.delete({ where: { id } });
    }
    expect(await prisma.region.count({ where: { id } })).toBe(0);
  });
});

databaseDescribe('Region translation database constraints', () => {
  const prisma = new PrismaClient();
  afterAll(async () => prisma.$disconnect());

  it('rejects a translation whose Region foreign key is missing', async () => {
    await expect(
      prisma.regionTranslation.create({
        data: { regionId: randomUUID(), locale: EditorialLocale.am },
      }),
    ).rejects.toMatchObject({ code: 'P2003' });
  });

  it('enforces one translation per Region and locale, with fixture rollback', async () => {
    const id = randomUUID();
    await expect(
      prisma.$transaction(async (tx) => {
        await tx.region.create({
          data: { id, name: 'G1B Unique', slug: `g1b-${id}` },
        });
        await tx.regionTranslation.create({
          data: { regionId: id, locale: EditorialLocale.am },
        });
        await tx.regionTranslation.create({
          data: { regionId: id, locale: EditorialLocale.am },
        });
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
    expect(await prisma.region.count({ where: { id } })).toBe(0);
  });

  it('restricts deleting a Region with a translation, with fixture rollback', async () => {
    const id = randomUUID();
    await expect(
      prisma.$transaction(async (tx) => {
        await tx.region.create({
          data: { id, name: 'G1B Restrict', slug: `g1b-${id}` },
        });
        await tx.regionTranslation.create({
          data: { regionId: id, locale: EditorialLocale.am },
        });
        await tx.region.delete({ where: { id } });
      }),
    ).rejects.toThrow(/RESTRICT setting of foreign key constraint/);
    expect(await prisma.region.count({ where: { id } })).toBe(0);
  });
});
