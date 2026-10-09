import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import {
  MediaRole,
  MediaStatus,
  MediaType,
  MediaVisibility,
  PublicationStatus,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageProvider } from '../storage/storage.provider';
import { DestinationMediaService } from './destination-media.service';

const destinationId = '11111111-1111-4111-8111-111111111111';
const otherDestinationId = '22222222-2222-4222-8222-222222222222';
const actorId = '33333333-3333-4333-8333-333333333333';
const mediaId = '44444444-4444-4444-8444-444444444444';
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const containing = (value: Record<string, unknown>): Record<string, unknown> =>
  expect.objectContaining(value) as Record<string, unknown>;

function attachment(status: MediaStatus = MediaStatus.READY) {
  return {
    mediaId,
    role: MediaRole.GALLERY,
    sortOrder: 3,
    altText: 'View',
    caption: 'Caption',
    createdAt: new Date('2026-10-07T00:00:00Z'),
    media: {
      status,
      mediaType: MediaType.IMAGE,
      mimeType: 'image/png',
      sizeBytes: png.length,
      storageKey: `private/destinations/${destinationId}/${mediaId}.png`,
    },
  };
}

function harness(status: PublicationStatus = PublicationStatus.DRAFT) {
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([{ id: destinationId, status }]),
    destinationMedia: {
      aggregate: jest.fn().mockResolvedValue({ _max: { sortOrder: 3 } }),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockResolvedValue(attachment()),
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(attachment()),
      update: jest.fn().mockResolvedValue(attachment()),
    },
    mediaAsset: {
      create: jest.fn().mockResolvedValue({ id: mediaId }),
      update: jest.fn().mockResolvedValue({ id: mediaId }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
  const prisma = {
    $transaction: jest.fn(async (operation: unknown) => {
      if (typeof operation === 'function') {
        return (operation as (client: typeof tx) => Promise<unknown>)(tx);
      }
      return Promise.all(operation as Promise<unknown>[]);
    }),
    destination: {
      findUnique: jest.fn().mockResolvedValue({ id: destinationId, status }),
    },
    destinationMedia: {
      count: jest.fn().mockResolvedValue(1),
      findMany: jest.fn().mockResolvedValue([attachment()]),
      findUnique: jest.fn().mockResolvedValue(attachment()),
    },
  };
  const storage = {
    putObject: jest.fn().mockResolvedValue({}),
    deleteObject: jest.fn().mockResolvedValue(undefined),
    readObject: jest.fn().mockResolvedValue(png),
  };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const service = new DestinationMediaService(
    prisma as unknown as PrismaService,
    storage as unknown as StorageProvider,
    audit as unknown as AuditService,
  );
  return { service, prisma, tx, storage, audit };
}

const file = () => ({
  buffer: png,
  mimetype: 'image/png',
  originalname: '../named destination.png',
  size: png.length,
});

describe('Destination image media service', () => {
  it('returns paginated safe Admin metadata without storage keys', async () => {
    const { service } = harness();
    const result = await service.list(destinationId, { page: 1, limit: 20 });
    expect(result.meta.total).toBe(1);
    expect(result.data[0]).toMatchObject({
      mediaId,
      status: MediaStatus.READY,
      previewPath: `/api/v1/admin/destinations/${destinationId}/media/${mediaId}/content`,
    });
    expect(JSON.stringify(result)).not.toContain('storageKey');
  });

  it('uploads a validated HERO and archives the previous HERO atomically with audit', async () => {
    const { service, tx, storage, audit } = harness();
    tx.destinationMedia.findMany.mockResolvedValue([{ mediaId }]);
    await service.upload(
      destinationId,
      actorId,
      { role: MediaRole.HERO },
      file(),
      {},
    );
    expect(storage.putObject).toHaveBeenCalledWith(
      containing({
        key: expect.stringMatching(
          /^private\/destinations\/[0-9a-f-]+\/[0-9a-f-]+\.png$/,
        ) as string,
        mimeType: 'image/png',
        sizeBytes: png.length,
      }),
    );
    expect(tx.mediaAsset.updateMany).toHaveBeenCalledWith(
      containing({ data: { status: MediaStatus.ARCHIVED } }),
    );
    expect(tx.mediaAsset.create).toHaveBeenCalledWith(
      containing({
        data: containing({
          mediaType: MediaType.IMAGE,
          status: MediaStatus.READY,
          visibility: MediaVisibility.PUBLIC,
          createdByUserId: actorId,
        }),
      }),
    );
    expect(tx.destinationMedia.create).toHaveBeenCalledWith(
      containing({
        data: containing({ role: MediaRole.HERO, sortOrder: 0 }),
      }),
    );
    expect(audit.record).toHaveBeenCalledWith(
      tx,
      containing({
        action: 'ADMIN_DESTINATION_MEDIA_HERO_REPLACED',
        metadata: containing({
          destinationId,
          mediaRole: MediaRole.HERO,
          previousMediaId: mediaId,
        }),
      }),
    );
    expect(JSON.stringify(audit.record.mock.calls)).not.toContain(
      'named destination',
    );
  });

  it('assigns a deterministic gallery order and rejects a full gallery', async () => {
    const { service, tx, storage, audit } = harness();
    await service.upload(
      destinationId,
      actorId,
      { role: MediaRole.GALLERY },
      file(),
      {},
    );
    expect(tx.destinationMedia.create).toHaveBeenCalledWith(
      containing({
        data: containing({
          role: MediaRole.GALLERY,
          sortOrder: 4,
        }),
      }),
    );
    expect(audit.record).toHaveBeenCalledWith(
      tx,
      containing({ action: 'ADMIN_DESTINATION_MEDIA_UPLOADED' }),
    );
    tx.destinationMedia.count.mockResolvedValue(12);
    await expect(
      service.upload(
        destinationId,
        actorId,
        { role: MediaRole.GALLERY },
        file(),
        {},
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(storage.deleteObject).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['spoofed MIME', { ...file(), mimetype: 'image/jpeg' }],
    ['SVG', { ...file(), mimetype: 'image/svg+xml' }],
    ['video', { ...file(), mimetype: 'video/mp4' }],
    ['empty', { ...file(), buffer: Buffer.alloc(0), size: 0 }],
    [
      'oversize',
      {
        ...file(),
        buffer: Buffer.alloc(10 * 1024 * 1024 + 1),
        size: 10 * 1024 * 1024 + 1,
      },
    ],
  ])('rejects %s before storage', async (_label, candidate) => {
    const { service, storage, tx } = harness();
    await expect(
      service.upload(
        destinationId,
        actorId,
        { role: MediaRole.GALLERY },
        candidate,
        {},
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(storage.putObject).not.toHaveBeenCalled();
    expect(tx.mediaAsset.create).not.toHaveBeenCalled();
  });

  it('rejects LOGO and a missing or archived destination before storage', async () => {
    const { service, prisma, storage } = harness();
    await expect(
      service.upload(
        destinationId,
        actorId,
        { role: MediaRole.LOGO } as never,
        file(),
        {},
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    prisma.destination.findUnique.mockResolvedValue(null);
    await expect(
      service.upload(
        destinationId,
        actorId,
        { role: MediaRole.HERO },
        file(),
        {},
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    prisma.destination.findUnique.mockResolvedValue({
      id: destinationId,
      status: PublicationStatus.ARCHIVED,
    });
    await expect(
      service.upload(
        destinationId,
        actorId,
        { role: MediaRole.HERO },
        file(),
        {},
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(storage.putObject).not.toHaveBeenCalled();
  });

  it('never starts DB persistence when storage fails and removes a new object after a DB failure', async () => {
    const { service, storage, tx } = harness();
    storage.putObject.mockRejectedValueOnce(new Error('storage failed'));
    await expect(
      service.upload(
        destinationId,
        actorId,
        { role: MediaRole.HERO },
        file(),
        {},
      ),
    ).rejects.toThrow('storage failed');
    expect(tx.mediaAsset.create).not.toHaveBeenCalled();
    tx.mediaAsset.create.mockRejectedValueOnce(new Error('DB failed'));
    await expect(
      service.upload(
        destinationId,
        actorId,
        { role: MediaRole.HERO },
        file(),
        {},
      ),
    ).rejects.toThrow('DB failed');
    expect(storage.deleteObject).toHaveBeenCalledTimes(2);
  });

  it('updates only trimmed metadata and hides foreign attachments', async () => {
    const { service, tx, audit } = harness();
    await service.update(
      destinationId,
      mediaId,
      actorId,
      { altText: '  New alt  ', caption: ' ' },
      {},
    );
    expect(tx.destinationMedia.update).toHaveBeenCalledWith(
      containing({ data: { altText: 'New alt', caption: null } }),
    );
    expect(audit.record).toHaveBeenCalledWith(
      tx,
      containing({ action: 'ADMIN_DESTINATION_MEDIA_UPDATED' }),
    );
    tx.destinationMedia.findUnique.mockResolvedValue(null);
    await expect(
      service.update(
        otherDestinationId,
        mediaId,
        actorId,
        { altText: 'X' },
        {},
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('archives a scoped image and rejects an already archived image', async () => {
    const { service, tx } = harness();
    expect(
      await service.archive(destinationId, mediaId, actorId, {}),
    ).toMatchObject({
      status: MediaStatus.ARCHIVED,
    });
    expect(tx.mediaAsset.update).toHaveBeenCalledWith({
      where: { id: mediaId },
      data: { status: MediaStatus.ARCHIVED },
    });
    tx.destinationMedia.findUnique.mockResolvedValue(
      attachment(MediaStatus.ARCHIVED),
    );
    await expect(
      service.archive(destinationId, mediaId, actorId, {}),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('reorders the exact active gallery and rejects duplicate, foreign, HERO or archived IDs', async () => {
    const { service, tx } = harness();
    tx.destinationMedia.findMany.mockResolvedValue([{ mediaId }]);
    await expect(
      service.reorder(destinationId, actorId, { mediaIds: [mediaId] }, {}),
    ).resolves.toEqual({ mediaIds: [mediaId] });
    expect(tx.destinationMedia.update).toHaveBeenCalledWith({
      where: { destinationId_mediaId: { destinationId, mediaId } },
      data: { sortOrder: 0 },
    });
    await expect(
      service.reorder(
        destinationId,
        actorId,
        { mediaIds: [mediaId, mediaId] },
        {},
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    for (const invalidId of [
      otherDestinationId,
      '55555555-5555-4555-8555-555555555555',
    ]) {
      await expect(
        service.reorder(destinationId, actorId, { mediaIds: [invalidId] }, {}),
      ).rejects.toBeInstanceOf(BadRequestException);
    }
    tx.destinationMedia.findMany.mockResolvedValue([]);
    await expect(
      service.reorder(destinationId, actorId, { mediaIds: [mediaId] }, {}),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('does not mutate any media on an archived destination', async () => {
    const { service, tx } = harness(PublicationStatus.ARCHIVED);
    await expect(
      service.update(destinationId, mediaId, actorId, { caption: 'X' }, {}),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      service.archive(destinationId, mediaId, actorId, {}),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      service.reorder(destinationId, actorId, { mediaIds: [] }, {}),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tx.mediaAsset.update).not.toHaveBeenCalled();
    expect(tx.destinationMedia.update).not.toHaveBeenCalled();
  });

  it('uses a scoped authenticated preview and never returns a key', async () => {
    const { service, storage } = harness();
    const image = await service.readAdminImage(destinationId, mediaId);
    expect(image).toEqual({ mimeType: 'image/png', body: png });
    expect(storage.readObject).toHaveBeenCalledWith(
      `private/destinations/${destinationId}/${mediaId}.png`,
    );
    expect(JSON.stringify(image)).not.toContain('storageKey');
  });
});
