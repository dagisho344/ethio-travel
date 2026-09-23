import {
  BusinessMemberRole,
  BusinessStatus,
  BusinessVerificationSummary,
  MediaRole,
  MediaStatus,
  MediaVisibility,
} from '@prisma/client';
import { BusinessMediaService } from './business-media/business-media.service';
import { BusinessesService } from './businesses/businesses.service';
import { PrismaService } from './prisma/prisma.service';
import { StorageAccessController } from './storage/storage-access.controller';
import { StorageAccessService } from './storage/storage-access.service';
import { StorageProvider } from './storage/storage.provider';

const businessId = '22222222-2222-4222-8222-222222222222';
const mediaId = '33333333-3333-4333-8333-333333333333';
const userId = '11111111-1111-4111-8111-111111111111';
const validPng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

type BusinessMediaCreateArgs = {
  data: {
    businessId: string;
    mediaId: string;
    role: MediaRole;
    sortOrder: number;
    altText: string | null;
    caption: string | null;
  };
};

type CreatedBusinessMedia = BusinessMediaCreateArgs['data'] & {
  media: {
    id: string;
    mimeType: string;
    status: MediaStatus;
  };
};

type PublicMediaLookupArgs = {
  where: {
    mediaId: string;
    media: {
      status: MediaStatus;
      visibility: MediaVisibility;
    };
    business: {
      status: BusinessStatus;
      verificationSummary: BusinessVerificationSummary;
    };
  };
};

type PublicMediaAttachment = {
  media: {
    storageKey: string;
    mimeType: string;
    sizeBytes: number;
  };
};

function mediaServiceFixture() {
  const businessMediaCreate = jest
    .fn<Promise<CreatedBusinessMedia>, [BusinessMediaCreateArgs]>()
    .mockImplementation(({ data }) =>
      Promise.resolve({
        ...data,
        media: {
          id: data.mediaId,
          mimeType: 'image/png',
          status: MediaStatus.READY,
        },
      }),
    );
  const mediaAssetCreate = jest
    .fn<Promise<{ id: string }>, [{ data: { id: string } }]>()
    .mockImplementation(({ data }) => Promise.resolve({ id: data.id }));
  const transaction = {
    businessMedia: {
      count: jest.fn().mockResolvedValue(0),
      create: businessMediaCreate,
      findMany: jest.fn().mockResolvedValue([]),
    },
    mediaAsset: {
      create: mediaAssetCreate,
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
  const prisma = {
    business: {
      findUnique: jest.fn().mockResolvedValue({ status: BusinessStatus.ACTIVE }),
    },
    $transaction: jest.fn(
      (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
    ),
  } as unknown as PrismaService;
  const businesses = {
    requireMembership: jest
      .fn()
      .mockResolvedValue({ role: BusinessMemberRole.OWNER }),
  } as unknown as BusinessesService;
  const storage = {
    deleteObject: jest.fn().mockResolvedValue(undefined),
    putObject: jest.fn().mockResolvedValue({
      key: `public/businesses/${businessId}/${mediaId}.png`,
      mimeType: 'image/png',
      sizeBytes: validPng.length,
    }),
  } as unknown as StorageProvider;
  return {
    service: new BusinessMediaService(prisma, businesses, storage),
    storage,
    transaction,
    businessMediaCreate,
  };
}

describe('public business media roles', () => {
  it.each([MediaRole.LOGO, MediaRole.HERO])(
    'archives the previous %s asset before replacing it',
    async (role) => {
      const { service, transaction } = mediaServiceFixture();
      transaction.businessMedia.findMany.mockResolvedValue([
        { mediaId: '44444444-4444-4444-8444-444444444444' },
      ]);

      await service.upload(
        userId,
        businessId,
        { role },
        {
          buffer: validPng,
          mimetype: 'image/png',
          originalname: 'business.png',
          size: validPng.length,
        },
      );

      expect(transaction.mediaAsset.updateMany).toHaveBeenCalledWith({
        where: {
          id: { in: ['44444444-4444-4444-8444-444444444444'] },
          status: { not: MediaStatus.ARCHIVED },
        },
        data: { status: MediaStatus.ARCHIVED },
      });
    },
  );

  it('assigns the next deterministic gallery sort order', async () => {
    const { service, transaction, businessMediaCreate } = mediaServiceFixture();
    transaction.businessMedia.count.mockResolvedValue(3);

    await service.upload(
      userId,
      businessId,
      { role: MediaRole.GALLERY },
      {
        buffer: validPng,
        mimetype: 'image/png',
        originalname: 'gallery.png',
        size: validPng.length,
      },
    );

    const createArgs = businessMediaCreate.mock.calls.at(0)?.at(0);
    expect(createArgs).toBeDefined();
    if (!createArgs) throw new Error('Expected a gallery media create call.');
    expect(createArgs.data.role).toBe(MediaRole.GALLERY);
    expect(createArgs.data.sortOrder).toBe(3);
  });

  it('streams only READY/PUBLIC media for a centrally eligible business', async () => {
    const findFirst = jest
      .fn<Promise<PublicMediaAttachment | null>, [PublicMediaLookupArgs]>()
      .mockResolvedValue({
        media: {
          storageKey: `public/businesses/${businessId}/${mediaId}.png`,
          mimeType: 'image/png',
          sizeBytes: validPng.length,
        },
      });
    const readObject = jest
      .fn<Promise<Buffer>, [string]>()
      .mockResolvedValue(validPng);
    const service = new StorageAccessService(
      { businessMedia: { findFirst } } as unknown as PrismaService,
      { readObject } as unknown as StorageProvider,
    );

    const media = await service.readPublicBusinessMedia(mediaId);

    const lookupArgs = findFirst.mock.calls.at(0)?.at(0);
    expect(lookupArgs).toBeDefined();
    if (!lookupArgs) throw new Error('Expected a public media lookup.');
    expect(lookupArgs.where.mediaId).toBe(mediaId);
    expect(lookupArgs.where.media).toEqual({
      status: MediaStatus.READY,
      visibility: MediaVisibility.PUBLIC,
    });
    expect(lookupArgs.where.business.status).toBe(BusinessStatus.ACTIVE);
    expect(lookupArgs.where.business.verificationSummary).toBe(
      BusinessVerificationSummary.VERIFIED,
    );
    expect(readObject).toHaveBeenCalledWith(
      `public/businesses/${businessId}/${mediaId}.png`,
    );
    expect(media.body).toEqual(validPng);
  });

  it('sets image-safe headers on controlled public media delivery', async () => {
    const setHeader = jest.fn();
    const controller = new StorageAccessController({
      readPublicBusinessMedia: jest.fn().mockResolvedValue({
        body: validPng,
        mimeType: 'image/png',
        sizeBytes: validPng.length,
      }),
    } as unknown as StorageAccessService);

    await controller.publicBusinessMedia(mediaId, { setHeader } as never);

    expect(setHeader).toHaveBeenCalledWith('Content-Type', 'image/png');
    expect(setHeader).toHaveBeenCalledWith(
      'Content-Length',
      String(validPng.length),
    );
    expect(setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
  });
});
