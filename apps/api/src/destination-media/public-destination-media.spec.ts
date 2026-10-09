import { NotFoundException } from '@nestjs/common';
import {
  EditorialLocale,
  LocationStatus,
  MediaRole,
  MediaStatus,
  MediaType,
  MediaVisibility,
  PublicationStatus,
} from '@prisma/client';
import { DestinationsService } from '../destinations/destinations.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageAccessService } from '../storage/storage-access.service';
import { StorageProvider } from '../storage/storage.provider';

const destinationId = '11111111-1111-4111-8111-111111111111';
const heroId = '22222222-2222-4222-8222-222222222222';
const galleryId = '33333333-3333-4333-8333-333333333333';
const containing = (value: Record<string, unknown>): Record<string, unknown> =>
  expect.objectContaining(value) as Record<string, unknown>;

function image(mediaId: string, role: MediaRole) {
  return {
    role,
    sortOrder: role === MediaRole.HERO ? 0 : 1,
    altText: 'View of Sodo',
    caption: null,
    media: {
      id: mediaId,
      mimeType: 'image/png',
      storageKey: `private/destinations/${destinationId}/${mediaId}.png`,
      createdByUserId: 'private-admin-id',
    },
  };
}

describe('Destination public image projection and delivery', () => {
  it('adds only one safe HERO to lists and a bounded safe gallery to detail', async () => {
    const source = {
      id: destinationId,
      name: 'Wolaita Sodo',
      slug: 'wolaita-sodo',
      shortDescription: 'Canonical summary',
      fullDescription: 'Canonical full description',
      travelInfo: null,
      status: PublicationStatus.PUBLISHED,
      translations: [
        {
          isPublished: true,
          displayName: 'ወላይታ ሶዶ',
          shortDescription: 'አጭር መግለጫ',
          fullDescription: 'ሙሉ መግለጫ',
        },
      ],
      media: [image(heroId, MediaRole.HERO)],
    };
    const destination = {
      findMany: jest.fn().mockResolvedValue([source]),
      findFirst: jest.fn().mockResolvedValue(source),
      count: jest.fn().mockResolvedValue(1),
    };
    const destinationMedia = {
      findMany: jest
        .fn()
        .mockResolvedValue([image(galleryId, MediaRole.GALLERY)]),
    };
    const prisma = {
      destination,
      destinationMedia,
      $transaction: jest.fn(async (operations: Promise<unknown>[]) =>
        Promise.all(operations),
      ),
    };
    const service = new DestinationsService(prisma as unknown as PrismaService);

    const list = await service.findPublic({
      page: 1,
      limit: 20,
      locale: EditorialLocale.am,
    });
    const listed = list.data[0];
    expect(listed).toMatchObject({
      id: destinationId,
      name: 'ወላይታ ሶዶ',
      media: {
        hero: {
          id: heroId,
          role: MediaRole.HERO,
          accessPath: `/api/v1/media/public/${heroId}`,
        },
      },
    });
    expect(JSON.stringify(listed)).not.toContain('gallery');
    expect(JSON.stringify(listed)).not.toContain('storageKey');
    expect(JSON.stringify(listed)).not.toContain('createdByUserId');
    expect(JSON.stringify(listed)).not.toContain('translations');
    expect(destination.findMany).toHaveBeenCalledWith(
      containing({
        include: containing({
          media: containing({ take: 1 }),
        }),
      }),
    );

    const detail = await service.findPublicBySlugs(
      'south',
      'sodo',
      'wolaita-sodo',
      EditorialLocale.am,
    );
    expect(detail).toMatchObject({
      id: destinationId,
      name: 'ወላይታ ሶዶ',
      media: {
        hero: { id: heroId },
        gallery: [{ id: galleryId, role: MediaRole.GALLERY }],
      },
    });
    expect(destinationMedia.findMany).toHaveBeenCalledWith(
      containing({
        where: containing({ destinationId }),
        take: 12,
      }),
    );
    expect(JSON.stringify(detail)).not.toContain('storageKey');
    expect(JSON.stringify(detail)).not.toContain('translations');
  });

  it('falls back to no HERO without changing destination publication or English content', async () => {
    const prisma = {
      destination: {
        findFirst: jest.fn().mockResolvedValue({
          id: destinationId,
          name: 'Wolaita Sodo',
          shortDescription: 'Canonical summary',
          fullDescription: 'Canonical full description',
          translations: [],
          media: [],
        }),
      },
      destinationMedia: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const service = new DestinationsService(prisma as unknown as PrismaService);
    await expect(
      service.findPublicBySlugs('south', 'sodo', 'wolaita-sodo'),
    ).resolves.toMatchObject({
      name: 'Wolaita Sodo',
      media: { hero: null, gallery: [] },
    });
  });

  it('streams only a READY/PUBLIC IMAGE under published and active ancestry', async () => {
    const key = `private/destinations/${destinationId}/${heroId}.png`;
    const businessMedia = { findFirst: jest.fn().mockResolvedValue(null) };
    const destinationMedia = {
      findFirst: jest.fn().mockResolvedValue({
        media: { storageKey: key, mimeType: 'image/png', sizeBytes: 8 },
      }),
    };
    const storage = {
      readObject: jest.fn().mockResolvedValue(Buffer.alloc(8)),
    };
    const service = new StorageAccessService(
      { businessMedia, destinationMedia } as unknown as PrismaService,
      storage as unknown as StorageProvider,
    );
    const result = await service.readPublicBusinessMedia(heroId);
    expect(result).toMatchObject({
      mimeType: 'image/png',
      cacheControl: 'no-store',
    });
    expect(storage.readObject).toHaveBeenCalledWith(key);
    expect(destinationMedia.findFirst).toHaveBeenCalledWith(
      containing({
        where: {
          mediaId: heroId,
          role: { in: [MediaRole.HERO, MediaRole.GALLERY] },
          media: {
            status: MediaStatus.READY,
            visibility: MediaVisibility.PUBLIC,
            mediaType: MediaType.IMAGE,
            mimeType: { in: ['image/jpeg', 'image/png', 'image/webp'] },
          },
          destination: {
            status: PublicationStatus.PUBLISHED,
            city: {
              status: LocationStatus.ACTIVE,
              region: { status: LocationStatus.ACTIVE },
            },
          },
        },
      }),
    );
    destinationMedia.findFirst.mockResolvedValue(null);
    await expect(
      service.readPublicBusinessMedia(heroId),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(storage.readObject).toHaveBeenCalledTimes(1);
  });
});
