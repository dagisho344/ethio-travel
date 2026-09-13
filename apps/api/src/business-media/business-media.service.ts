import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BusinessMemberRole,
  BusinessStatus,
  MediaRole,
  MediaStatus,
  MediaType,
  MediaVisibility,
  Prisma,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import { BusinessesService } from '../businesses/businesses.service';
import { PrismaService } from '../prisma/prisma.service';
import { STORAGE_PROVIDER, StorageProvider } from '../storage/storage.provider';
import {
  ReorderBusinessMediaDto,
  UpdateBusinessMediaDto,
  UploadBusinessMediaDto,
} from './dto/business-media.dto';

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const imageTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
type UploadedFile = {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
};
const mediaInclude = { media: true } satisfies Prisma.BusinessMediaInclude;

@Injectable()
export class BusinessMediaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly businesses: BusinessesService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
  ) {}

  async list(userId: string, businessId: string) {
    await this.requireRead(userId, businessId);
    return this.prisma.businessMedia.findMany({
      where: { businessId },
      include: mediaInclude,
      orderBy: [{ role: 'asc' }, { sortOrder: 'asc' }],
    });
  }

  async upload(
    userId: string,
    businessId: string,
    dto: UploadBusinessMediaDto,
    file: UploadedFile,
  ) {
    await this.requireWrite(userId, businessId);
    await this.assertBusinessMutable(businessId);
    this.assertImage(file);
    const id = randomUUID();
    const extension = this.extensionFor(file.mimetype);
    const key = `public/businesses/${businessId}/${id}.${extension}`;
    await this.storage.putObject({
      key,
      mimeType: file.mimetype,
      sizeBytes: file.size,
      body: file.buffer,
    });
    try {
      return await this.prisma.$transaction(async (tx) => {
        if (dto.role === MediaRole.LOGO || dto.role === MediaRole.HERO) {
          const previous = await tx.businessMedia.findMany({
            where: { businessId, role: dto.role },
            select: { mediaId: true },
          });
          if (previous.length)
            await tx.mediaAsset.updateMany({
              where: {
                id: { in: previous.map((item) => item.mediaId) },
                status: { not: MediaStatus.ARCHIVED },
              },
              data: { status: MediaStatus.ARCHIVED },
            });
        }
        const asset = await tx.mediaAsset.create({
          data: {
            id,
            storageKey: key,
            originalFilename: this.safeFilename(file.originalname, extension),
            mimeType: file.mimetype,
            mediaType: MediaType.IMAGE,
            sizeBytes: file.size,
            visibility: MediaVisibility.PUBLIC,
            status: MediaStatus.READY,
            createdByUserId: userId,
          },
        });
        const sortOrder =
          dto.role === MediaRole.GALLERY
            ? await tx.businessMedia.count({
                where: { businessId, role: MediaRole.GALLERY },
              })
            : 0;
        return tx.businessMedia.create({
          data: {
            businessId,
            mediaId: asset.id,
            role: dto.role,
            sortOrder,
            altText: this.optional(dto.altText),
            caption: this.optional(dto.caption),
          },
          include: mediaInclude,
        });
      });
    } catch (error) {
      await this.storage.deleteObject(key).catch(() => undefined);
      throw error;
    }
  }

  async update(
    userId: string,
    businessId: string,
    mediaId: string,
    dto: UpdateBusinessMediaDto,
  ) {
    await this.requireWrite(userId, businessId);
    await this.findAttachment(businessId, mediaId);
    return this.prisma.businessMedia.update({
      where: { businessId_mediaId: { businessId, mediaId } },
      data: {
        altText:
          dto.altText === undefined ? undefined : this.optional(dto.altText),
        caption:
          dto.caption === undefined ? undefined : this.optional(dto.caption),
      },
      include: mediaInclude,
    });
  }

  async archive(userId: string, businessId: string, mediaId: string) {
    await this.requireWrite(userId, businessId);
    const attachment = await this.findAttachment(businessId, mediaId);
    if (attachment.media.status === MediaStatus.ARCHIVED)
      throw new ConflictException('Media is already archived.');
    await this.prisma.mediaAsset.update({
      where: { id: mediaId },
      data: { status: MediaStatus.ARCHIVED },
    });
    return {
      ...attachment,
      media: { ...attachment.media, status: MediaStatus.ARCHIVED },
    };
  }

  async reorder(
    userId: string,
    businessId: string,
    dto: ReorderBusinessMediaDto,
  ) {
    await this.requireWrite(userId, businessId);
    if (new Set(dto.mediaIds).size !== dto.mediaIds.length)
      throw new BadRequestException('Media IDs must be unique.');
    const attachments = await this.prisma.businessMedia.findMany({
      where: {
        businessId,
        role: MediaRole.GALLERY,
        media: { status: { not: MediaStatus.ARCHIVED } },
      },
      select: { mediaId: true },
    });
    if (
      attachments.length !== dto.mediaIds.length ||
      attachments.some((item) => !dto.mediaIds.includes(item.mediaId))
    )
      throw new BadRequestException(
        'Gallery order must contain every active gallery item exactly once.',
      );
    await this.prisma.$transaction(
      dto.mediaIds.map((mediaId, sortOrder) =>
        this.prisma.businessMedia.update({
          where: { businessId_mediaId: { businessId, mediaId } },
          data: { sortOrder },
        }),
      ),
    );
    return this.list(userId, businessId);
  }

  private async requireRead(userId: string, businessId: string) {
    return this.businesses.requireMembership(userId, businessId, [
      BusinessMemberRole.OWNER,
      BusinessMemberRole.MANAGER,
      BusinessMemberRole.STAFF,
    ]);
  }
  private async requireWrite(userId: string, businessId: string) {
    return this.businesses.requireMembership(userId, businessId, [
      BusinessMemberRole.OWNER,
      BusinessMemberRole.MANAGER,
    ]);
  }
  private async assertBusinessMutable(businessId: string) {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: { status: true },
    });
    if (!business) throw new NotFoundException('Business not found.');
    if (business.status === BusinessStatus.ARCHIVED)
      throw new ConflictException('Archived businesses cannot change media.');
  }
  private async findAttachment(businessId: string, mediaId: string) {
    const attachment = await this.prisma.businessMedia.findUnique({
      where: { businessId_mediaId: { businessId, mediaId } },
      include: mediaInclude,
    });
    if (!attachment) throw new NotFoundException('Business media not found.');
    return attachment;
  }
  private assertImage(file: UploadedFile) {
    if (!file || !Buffer.isBuffer(file.buffer) || file.size < 1)
      throw new BadRequestException('An image file is required.');
    if (file.size > MAX_IMAGE_BYTES)
      throw new BadRequestException('Business images must not exceed 10 MB.');
    if (
      !imageTypes.has(file.mimetype) ||
      !this.matchesImageSignature(file.buffer, file.mimetype)
    )
      throw new BadRequestException(
        'Only valid JPEG, PNG, and WebP images are allowed.',
      );
  }
  private matchesImageSignature(buffer: Buffer, mimeType: string) {
    if (mimeType === 'image/jpeg')
      return (
        buffer.length >= 3 &&
        buffer[0] === 0xff &&
        buffer[1] === 0xd8 &&
        buffer[2] === 0xff
      );
    if (mimeType === 'image/png')
      return (
        buffer.length >= 8 &&
        buffer
          .subarray(0, 8)
          .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
      );
    return (
      buffer.length >= 12 &&
      buffer.subarray(0, 4).toString() === 'RIFF' &&
      buffer.subarray(8, 12).toString() === 'WEBP'
    );
  }
  private extensionFor(mimeType: string) {
    return mimeType === 'image/jpeg'
      ? 'jpg'
      : mimeType === 'image/png'
        ? 'png'
        : 'webp';
  }
  private safeFilename(filename: string, extension: string) {
    const base =
      filename.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 220) || 'upload';
    return `${base.replace(new RegExp(`${extname(base)}$`), '')}.${extension}`;
  }
  private optional(value: string | null | undefined) {
    const text = value?.trim();
    return text || null;
  }
}
