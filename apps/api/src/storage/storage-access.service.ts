import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  BusinessStatus,
  BusinessVerificationSummary,
  LocationStatus,
  MediaRole,
  MediaStatus,
  MediaType,
  MediaVisibility,
  PublicationStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { STORAGE_PROVIDER, StorageProvider } from './storage.provider';

@Injectable()
export class StorageAccessService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
  ) {}

  async readPublicBusinessMedia(mediaId: string) {
    const attachment = await this.prisma.businessMedia.findFirst({
      where: {
        mediaId,
        media: {
          status: MediaStatus.READY,
          visibility: MediaVisibility.PUBLIC,
        },
        business: {
          status: BusinessStatus.ACTIVE,
          verificationSummary: BusinessVerificationSummary.VERIFIED,
          category: { isActive: true },
          city: {
            status: LocationStatus.ACTIVE,
            region: { status: LocationStatus.ACTIVE },
          },
          destination: { is: null },
        },
      },
      select: {
        media: {
          select: {
            storageKey: true,
            mimeType: true,
            sizeBytes: true,
          },
        },
      },
    });
    const destinationAttachment =
      attachment ??
      (await this.prisma.businessMedia.findFirst({
        where: {
          mediaId,
          media: {
            status: MediaStatus.READY,
            visibility: MediaVisibility.PUBLIC,
          },
          business: {
            status: BusinessStatus.ACTIVE,
            verificationSummary: BusinessVerificationSummary.VERIFIED,
            category: { isActive: true },
            city: {
              status: LocationStatus.ACTIVE,
              region: { status: LocationStatus.ACTIVE },
            },
            destination: { is: { status: PublicationStatus.PUBLISHED } },
          },
        },
        select: {
          media: {
            select: { storageKey: true, mimeType: true, sizeBytes: true },
          },
        },
      }));
    if (destinationAttachment)
      return {
        ...destinationAttachment.media,
        body: await this.storage.readObject(
          destinationAttachment.media.storageKey,
        ),
      };

    const destinationImage = await this.prisma.destinationMedia.findFirst({
      where: {
        mediaId,
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
      select: {
        media: {
          select: { storageKey: true, mimeType: true, sizeBytes: true },
        },
      },
    });
    if (!destinationImage)
      throw new NotFoundException('Public media not found.');
    return {
      ...destinationImage.media,
      body: await this.storage.readObject(destinationImage.media.storageKey),
      cacheControl: 'no-store',
    };
  }
}
