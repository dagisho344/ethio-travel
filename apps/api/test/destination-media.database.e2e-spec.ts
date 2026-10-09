import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import {
  LocationStatus,
  MediaRole,
  MediaStatus,
  MediaType,
  MediaVisibility,
  Prisma,
  PublicationStatus,
} from '@prisma/client';
import { AuditService } from '../src/audit/audit.service';
import { AUDIT_ACTIONS } from '../src/audit/audit.constants';
import { DestinationMediaService } from '../src/destination-media/destination-media.service';
import { DestinationsService } from '../src/destinations/destinations.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { StorageAccessService } from '../src/storage/storage-access.service';
import {
  PutStorageObject,
  StorageProvider,
} from '../src/storage/storage.provider';

const databaseDescribe =
  process.env.DESTINATION_MEDIA_DATABASE_TESTS === '1'
    ? describe
    : describe.skip;
const schema = `phase17b1_${randomUUID().replaceAll('-', '').slice(0, 16)}`;
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);

class MemoryStorage implements StorageProvider {
  readonly objects = new Map<string, Buffer>();
  private uploadGate: {
    arrivals: number;
    required: number;
    wait: Promise<void>;
    release: () => void;
  } | null = null;

  synchronizeNextUploads(required: number) {
    let release: () => void = () => undefined;
    const wait = new Promise<void>((resolve) => {
      release = () => resolve();
    });
    this.uploadGate = { arrivals: 0, required, wait, release };
  }

  async putObject(input: PutStorageObject) {
    this.objects.set(input.key, Buffer.from(input.body));
    const gate = this.uploadGate;
    if (gate) {
      gate.arrivals += 1;
      if (gate.arrivals === gate.required) {
        this.uploadGate = null;
        gate.release();
      }
      await gate.wait;
    }
    return {
      key: input.key,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
    };
  }

  getObjectMetadata(key: string) {
    const body = this.objects.get(key);
    return Promise.resolve(
      body ? { key, mimeType: 'image/png', sizeBytes: body.length } : null,
    );
  }

  readObject(key: string) {
    const body = this.objects.get(key);
    if (!body) return Promise.reject(new Error('Missing test storage object.'));
    return Promise.resolve(body);
  }

  deleteObject(key: string) {
    this.objects.delete(key);
    return Promise.resolve();
  }

  publicUrl() {
    return null;
  }

  signedPrivateReadUrl() {
    return Promise.resolve(null);
  }
}

databaseDescribe('Phase 17B-1 destination image PostgreSQL integration', () => {
  let root: PrismaService | undefined;
  let db: PrismaService | undefined;
  let dbB: PrismaService | undefined;
  let schemaCreated = false;
  let publicCounts: { destinations: number; assets: number; audits: number };
  let destinationId: string;
  let adminId: string;
  let media: DestinationMediaService;
  let destinations: DestinationsService;
  let access: StorageAccessService;
  const storage = new MemoryStorage();

  beforeAll(async () => {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) throw new Error('DATABASE_URL is required.');
    const parsed = new URL(databaseUrl);
    if (parsed.searchParams.get('schema') !== 'public') {
      throw new Error('The source DATABASE_URL must use schema=public.');
    }
    if (!/^phase17b1_[a-f0-9]{16}$/.test(schema)) {
      throw new Error('Unsafe disposable schema name.');
    }
    root = new PrismaService({ datasources: { db: { url: databaseUrl } } });
    await root.$connect();
    const existing = await root.$queryRaw<Array<{ name: string }>>(
      Prisma.sql`SELECT nspname AS name FROM pg_namespace WHERE nspname = ${schema}`,
    );
    if (existing.length) throw new Error('Disposable schema already exists.');
    publicCounts = {
      destinations: await root.destination.count(),
      assets: await root.mediaAsset.count(),
      audits: await root.auditLog.count(),
    };
    await root.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
    schemaCreated = true;
    parsed.searchParams.set('schema', schema);
    const migrate = spawnSync(
      process.execPath,
      [require.resolve('prisma/build/index.js'), 'migrate', 'deploy'],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
        env: { ...process.env, DATABASE_URL: parsed.toString() },
        timeout: 180_000,
      },
    );
    if (migrate.status !== 0) {
      throw new Error(
        `Disposable-schema migration failed (${migrate.status}).`,
      );
    }
    db = new PrismaService({ datasources: { db: { url: parsed.toString() } } });
    await db.$connect();
    dbB = new PrismaService({
      datasources: { db: { url: parsed.toString() } },
    });
    await dbB.$connect();
    const admin = await db.user.create({
      data: {
        email: `${schema}@example.invalid`,
        passwordHash: 'test-only-hash',
      },
    });
    adminId = admin.id;
    const region = await db.region.create({
      data: {
        name: 'Test Region',
        slug: 'test-region',
        status: LocationStatus.ACTIVE,
      },
    });
    const city = await db.city.create({
      data: {
        regionId: region.id,
        name: 'Test City',
        slug: 'test-city',
        latitude: 9,
        longitude: 38,
        status: LocationStatus.ACTIVE,
      },
    });
    const destination = await db.destination.create({
      data: {
        cityId: city.id,
        name: 'Test Destination',
        slug: 'test-destination',
        shortDescription: 'Test summary',
        fullDescription: 'Test description',
        latitude: 9,
        longitude: 38,
        status: PublicationStatus.PUBLISHED,
        publishedAt: new Date(),
      },
    });
    destinationId = destination.id;
    media = new DestinationMediaService(db, storage, new AuditService(db));
    destinations = new DestinationsService(db);
    access = new StorageAccessService(db, storage);
  }, 210_000);

  afterAll(async () => {
    await db?.$disconnect();
    await dbB?.$disconnect();
    if (root) {
      try {
        if (schemaCreated) {
          if (!/^phase17b1_[a-f0-9]{16}$/.test(schema)) {
            throw new Error('Refusing unsafe disposable schema cleanup.');
          }
          await root.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
          expect(
            await root.$queryRaw<Array<{ name: string }>>(
              Prisma.sql`SELECT nspname AS name FROM pg_namespace WHERE nspname = ${schema}`,
            ),
          ).toHaveLength(0);
          expect({
            destinations: await root.destination.count(),
            assets: await root.mediaAsset.count(),
            audits: await root.auditLog.count(),
          }).toEqual(publicCounts);
        }
      } finally {
        await root.$disconnect();
      }
    }
  }, 30_000);

  it('persists images and audit, replaces HERO, serves only eligible public assets', async () => {
    const database = db!;
    const upload = () => ({
      buffer: png,
      mimetype: 'image/png',
      originalname: 'cover.png',
      size: png.length,
    });
    const first = await media.upload(
      destinationId,
      adminId,
      { role: MediaRole.HERO },
      upload(),
      {},
    );
    const second = await media.upload(
      destinationId,
      adminId,
      { role: MediaRole.HERO },
      upload(),
      {},
    );
    expect(first).not.toHaveProperty('storageKey');
    expect(
      await database.mediaAsset.findUniqueOrThrow({
        where: { id: first.mediaId },
      }),
    ).toMatchObject({ status: MediaStatus.ARCHIVED });
    expect(
      await database.mediaAsset.findUniqueOrThrow({
        where: { id: second.mediaId },
      }),
    ).toMatchObject({ status: MediaStatus.READY });
    const gallery = await media.upload(
      destinationId,
      adminId,
      { role: MediaRole.GALLERY },
      upload(),
      {},
    );
    const listed = await media.list(destinationId, { page: 1, limit: 20 });
    expect(listed.meta.total).toBe(3);
    expect(listed.data[0]).not.toHaveProperty('storageKey');
    const publicList = await destinations.findPublic({ page: 1, limit: 20 });
    expect(JSON.stringify(publicList)).not.toContain('storageKey');
    const detail = await destinations.findPublicBySlugs(
      'test-region',
      'test-city',
      'test-destination',
    );
    expect(detail).toMatchObject({
      media: {
        hero: { id: second.mediaId },
        gallery: [{ id: gallery.mediaId }],
      },
    });
    expect((await access.readPublicBusinessMedia(second.mediaId)).body).toEqual(
      png,
    );
    await expect(access.readPublicBusinessMedia(first.mediaId)).rejects.toThrow(
      'Public media not found',
    );
    for (const status of [
      PublicationStatus.DRAFT,
      PublicationStatus.ARCHIVED,
      PublicationStatus.INACTIVE,
    ]) {
      await database.destination.update({
        where: { id: destinationId },
        data: { status },
      });
      await expect(
        access.readPublicBusinessMedia(second.mediaId),
      ).rejects.toThrow('Public media not found');
    }
    const source = await database.destination.update({
      where: { id: destinationId },
      data: { status: PublicationStatus.PUBLISHED },
    });
    const city = await database.city.update({
      where: { id: source.cityId },
      data: { status: LocationStatus.INACTIVE },
    });
    await expect(
      access.readPublicBusinessMedia(second.mediaId),
    ).rejects.toThrow('Public media not found');
    await database.city.update({
      where: { id: city.id },
      data: { status: LocationStatus.ACTIVE },
    });
    await database.region.update({
      where: { id: city.regionId },
      data: { status: LocationStatus.INACTIVE },
    });
    await expect(
      access.readPublicBusinessMedia(second.mediaId),
    ).rejects.toThrow('Public media not found');
    await database.region.update({
      where: { id: city.regionId },
      data: { status: LocationStatus.ACTIVE },
    });
    for (const data of [
      { status: MediaStatus.ARCHIVED },
      { visibility: MediaVisibility.PRIVATE },
      { mediaType: MediaType.VIDEO },
    ]) {
      await database.mediaAsset.update({ where: { id: second.mediaId }, data });
      await expect(
        access.readPublicBusinessMedia(second.mediaId),
      ).rejects.toThrow('Public media not found');
      await database.mediaAsset.update({
        where: { id: second.mediaId },
        data: {
          status: MediaStatus.READY,
          visibility: MediaVisibility.PUBLIC,
          mediaType: MediaType.IMAGE,
        },
      });
    }
    const unattached = await database.mediaAsset.create({
      data: {
        storageKey: `private/destinations/${destinationId}/${randomUUID()}.png`,
        originalFilename: 'unattached.png',
        mimeType: 'image/png',
        mediaType: MediaType.IMAGE,
        sizeBytes: png.length,
        status: MediaStatus.READY,
        visibility: MediaVisibility.PUBLIC,
        createdByUserId: adminId,
      },
    });
    await expect(access.readPublicBusinessMedia(unattached.id)).rejects.toThrow(
      'Public media not found',
    );
    await expect(access.readPublicBusinessMedia(randomUUID())).rejects.toThrow(
      'Public media not found',
    );
    const third = await media.upload(
      destinationId,
      adminId,
      { role: MediaRole.HERO },
      upload(),
      {},
    );
    const history = await database.destinationMedia.findMany({
      where: { destinationId, role: MediaRole.HERO },
      include: { media: { select: { status: true } } },
    });
    expect(history).toHaveLength(3);
    expect(
      history.filter((item) => item.media.status === MediaStatus.ARCHIVED),
    ).toHaveLength(2);
    expect(
      history.filter((item) => item.media.status !== MediaStatus.ARCHIVED),
    ).toHaveLength(1);
    expect(
      history.find((item) => item.media.status === MediaStatus.READY)?.mediaId,
    ).toBe(third.mediaId);
    const latest = await destinations.findPublicBySlugs(
      'test-region',
      'test-city',
      'test-destination',
    );
    expect(latest).toMatchObject({
      media: {
        hero: { id: third.mediaId },
        gallery: [{ id: gallery.mediaId }],
      },
    });
    expect(
      await database.auditLog.count({ where: { entityId: destinationId } }),
    ).toBe(4);
    const auditRows = await database.auditLog.findMany({
      where: { entityId: destinationId },
      select: { action: true, metadata: true },
    });
    expect(auditRows.map((row) => row.action).sort()).toEqual(
      [
        AUDIT_ACTIONS.ADMIN_DESTINATION_MEDIA_UPLOADED,
        AUDIT_ACTIONS.ADMIN_DESTINATION_MEDIA_UPLOADED,
        AUDIT_ACTIONS.ADMIN_DESTINATION_MEDIA_HERO_REPLACED,
        AUDIT_ACTIONS.ADMIN_DESTINATION_MEDIA_HERO_REPLACED,
      ].sort(),
    );
    expect(JSON.stringify(auditRows)).not.toContain('storageKey');
    expect(JSON.stringify(auditRows)).not.toContain('cover.png');
  });

  it('persists gallery metadata, exact order, archive state and safe public projection', async () => {
    const database = db!;
    const first = await database.destinationMedia.findFirstOrThrow({
      where: {
        destinationId,
        role: MediaRole.GALLERY,
        media: { status: MediaStatus.READY },
      },
    });
    const second = await media.upload(
      destinationId,
      adminId,
      { role: MediaRole.GALLERY, altText: 'Second view' },
      {
        buffer: png,
        mimetype: 'image/png',
        originalname: 'gallery.png',
        size: png.length,
      },
      {},
    );
    const updated = await media.update(
      destinationId,
      second.mediaId,
      adminId,
      { altText: '  Updated view  ', caption: '   ' },
      {},
    );
    expect(updated).toMatchObject({ altText: 'Updated view', caption: null });
    expect(updated).not.toHaveProperty('storageKey');
    await media.reorder(
      destinationId,
      adminId,
      { mediaIds: [second.mediaId, first.mediaId] },
      {},
    );
    const ordered = await database.destinationMedia.findMany({
      where: { destinationId, role: MediaRole.GALLERY },
      orderBy: { sortOrder: 'asc' },
      select: { mediaId: true, sortOrder: true, altText: true, caption: true },
    });
    expect(
      ordered.map(({ mediaId, sortOrder }) => ({ mediaId, sortOrder })),
    ).toEqual([
      { mediaId: second.mediaId, sortOrder: 0 },
      { mediaId: first.mediaId, sortOrder: 1 },
    ]);
    expect(ordered[0]).toMatchObject({
      altText: 'Updated view',
      caption: null,
    });
    await expect(
      media.reorder(destinationId, adminId, { mediaIds: [second.mediaId] }, {}),
    ).rejects.toThrow('Gallery order must contain every active gallery image');
    await media.archive(destinationId, first.mediaId, adminId, {});
    expect(
      (
        await database.mediaAsset.findUniqueOrThrow({
          where: { id: first.mediaId },
        })
      ).status,
    ).toBe(MediaStatus.ARCHIVED);
    await expect(access.readPublicBusinessMedia(first.mediaId)).rejects.toThrow(
      'Public media not found',
    );
    const detail = await destinations.findPublicBySlugs(
      'test-region',
      'test-city',
      'test-destination',
    );
    expect(detail).toMatchObject({
      media: { gallery: [{ id: second.mediaId }] },
    });
    expect(JSON.stringify(detail)).not.toContain(first.mediaId);
    const actions = await database.auditLog.findMany({
      where: { entityId: destinationId },
      select: { action: true },
    });
    for (const action of [
      AUDIT_ACTIONS.ADMIN_DESTINATION_MEDIA_UPDATED,
      AUDIT_ACTIONS.ADMIN_DESTINATION_MEDIA_REORDERED,
      AUDIT_ACTIONS.ADMIN_DESTINATION_MEDIA_ARCHIVED,
    ])
      expect(actions.some((entry) => entry.action === action)).toBe(true);
  });

  it('rejects direct database writes that would create two non-archived HERO attachments', async () => {
    const database = db!;
    const existing = await database.destinationMedia.findFirstOrThrow({
      where: {
        destinationId,
        role: MediaRole.HERO,
        media: { status: MediaStatus.READY },
      },
    });
    const asset = await database.mediaAsset.create({
      data: {
        storageKey: `private/destinations/${destinationId}/${randomUUID()}.png`,
        originalFilename: 'direct.png',
        mimeType: 'image/png',
        mediaType: MediaType.IMAGE,
        sizeBytes: png.length,
        status: MediaStatus.READY,
        visibility: MediaVisibility.PUBLIC,
        createdByUserId: adminId,
      },
    });
    await expect(
      database.destinationMedia.create({
        data: { destinationId, mediaId: asset.id, role: MediaRole.HERO },
      }),
    ).rejects.toThrow();
    const archived = await database.destinationMedia.findFirstOrThrow({
      where: {
        destinationId,
        role: MediaRole.HERO,
        media: { status: MediaStatus.ARCHIVED },
      },
    });
    await expect(
      database.mediaAsset.update({
        where: { id: archived.mediaId },
        data: { status: MediaStatus.READY },
      }),
    ).rejects.toThrow();
    expect(
      (
        await database.mediaAsset.findUniqueOrThrow({
          where: { id: archived.mediaId },
        })
      ).status,
    ).toBe(MediaStatus.ARCHIVED);
    expect(
      (
        await database.mediaAsset.findUniqueOrThrow({
          where: { id: existing.mediaId },
        })
      ).status,
    ).toBe(MediaStatus.READY);
  });

  it('serializes two competing HERO replacements across independent connections', async () => {
    const database = db!;
    const other = new DestinationMediaService(
      dbB!,
      storage,
      new AuditService(dbB!),
    );
    const beforeGallery = await database.destinationMedia.count({
      where: { destinationId, role: MediaRole.GALLERY },
    });
    const beforeHistory = await database.destinationMedia.count({
      where: { destinationId, role: MediaRole.HERO },
    });
    const upload = () => ({
      buffer: png,
      mimetype: 'image/png',
      originalname: 'concurrent.png',
      size: png.length,
    });
    storage.synchronizeNextUploads(2);
    const [first, second] = await Promise.all([
      media.upload(
        destinationId,
        adminId,
        { role: MediaRole.HERO },
        upload(),
        {},
      ),
      other.upload(
        destinationId,
        adminId,
        { role: MediaRole.HERO },
        upload(),
        {},
      ),
    ]);
    expect(first.mediaId).not.toBe(second.mediaId);
    const history = await database.destinationMedia.findMany({
      where: { destinationId, role: MediaRole.HERO },
      include: { media: { select: { status: true } } },
    });
    expect(history).toHaveLength(beforeHistory + 2);
    expect(
      history.filter((item) => item.media.status !== MediaStatus.ARCHIVED),
    ).toHaveLength(1);
    expect(
      await database.destinationMedia.count({
        where: { destinationId, role: MediaRole.GALLERY },
      }),
    ).toBe(beforeGallery);
  });

  it('cleans storage after a real database FK failure', async () => {
    const beforeAssets = await db!.mediaAsset.count();
    const beforeAttachments = await db!.destinationMedia.count();
    const beforeObjects = storage.objects.size;
    const current = await db!.destinationMedia.findFirstOrThrow({
      where: {
        destinationId,
        role: MediaRole.HERO,
        media: { status: MediaStatus.READY },
      },
    });
    await expect(
      media.upload(
        destinationId,
        randomUUID(),
        { role: MediaRole.HERO },
        {
          buffer: png,
          mimetype: 'image/png',
          originalname: 'failure.png',
          size: png.length,
        },
        {},
      ),
    ).rejects.toThrow();
    expect(await db!.mediaAsset.count()).toBe(beforeAssets);
    expect(await db!.destinationMedia.count()).toBe(beforeAttachments);
    expect(storage.objects.size).toBe(beforeObjects);
    expect(
      (
        await db!.mediaAsset.findUniqueOrThrow({
          where: { id: current.mediaId },
        })
      ).status,
    ).toBe(MediaStatus.READY);
  });
});
