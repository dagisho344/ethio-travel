import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  MediaRole,
  MediaStatus,
  MediaType,
  MediaVisibility,
  Prisma,
  PublicationStatus,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from '../audit/audit.constants';
import { AuditContext, AuditService } from '../audit/audit.service';
import { paginate, PaginationQueryDto } from '../common/dto/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';
import { STORAGE_PROVIDER, StorageProvider } from '../storage/storage.provider';
import {
  ReorderDestinationMediaDto,
  UpdateDestinationMediaDto,
  UploadDestinationMediaDto,
} from './dto/destination-media.dto';

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_ACTIVE_GALLERY = 12;
const imageTypes = ['image/jpeg', 'image/png', 'image/webp'] as const;

export type DestinationImageFile = {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
};

const adminMediaSelect = {
  mediaId: true,
  role: true,
  sortOrder: true,
  altText: true,
  caption: true,
  createdAt: true,
  media: {
    select: {
      status: true,
      mediaType: true,
      mimeType: true,
      sizeBytes: true,
    },
  },
} satisfies Prisma.DestinationMediaSelect;

type AdminMediaRecord = Prisma.DestinationMediaGetPayload<{
  select: typeof adminMediaSelect;
}>;

@Injectable()
export class DestinationMediaService {
  private readonly logger = new Logger(DestinationMediaService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
    private readonly audit: AuditService,
  ) {}

  async list(destinationId: string, query: PaginationQueryDto) {
    await this.requireDestination(destinationId);
    const where: Prisma.DestinationMediaWhereInput = { destinationId };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.destinationMedia.findMany({
        where,
        select: adminMediaSelect,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.destinationMedia.count({ where }),
    ]);
    return paginate(
      items.map((item) => this.toAdmin(destinationId, item)),
      total,
      query.page,
      query.limit,
    );
  }

  async upload(
    destinationId: string,
    actorUserId: string,
    dto: UploadDestinationMediaDto,
    file: DestinationImageFile,
    context: AuditContext,
  ) {
    if (dto.role !== MediaRole.HERO && dto.role !== MediaRole.GALLERY)
      throw new BadRequestException(
        'Only HERO and GALLERY destination images are allowed.',
      );
    await this.requireMutableDestination(destinationId);
    this.assertImage(file);

    const id = randomUUID();
    const extension = this.extensionFor(file.mimetype);
    const key = `private/destinations/${destinationId}/${id}.${extension}`;
    try {
      await this.storage.putObject({
        key,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        body: file.buffer,
      });
    } catch (error) {
      await this.cleanupFailedUpload(key, destinationId, id);
      throw error;
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.lockMutableDestination(tx, destinationId);
        let replacedMediaId: string | null = null;
        if (dto.role === MediaRole.HERO) {
          const previous = await tx.destinationMedia.findMany({
            where: {
              destinationId,
              role: MediaRole.HERO,
              media: { status: { not: MediaStatus.ARCHIVED } },
            },
            select: { mediaId: true },
          });
          if (previous.length) {
            replacedMediaId = previous[0]?.mediaId ?? null;
            await tx.mediaAsset.updateMany({
              where: { id: { in: previous.map((item) => item.mediaId) } },
              data: { status: MediaStatus.ARCHIVED },
            });
          }
        } else {
          const active = await tx.destinationMedia.count({
            where: {
              destinationId,
              role: MediaRole.GALLERY,
              media: { status: MediaStatus.READY },
            },
          });
          if (active >= MAX_ACTIVE_GALLERY)
            throw new ConflictException('Destination gallery is full.');
        }

        const sortOrder =
          dto.role === MediaRole.GALLERY
            ? ((
                await tx.destinationMedia.aggregate({
                  where: { destinationId, role: MediaRole.GALLERY },
                  _max: { sortOrder: true },
                })
              )._max.sortOrder ?? -1) + 1
            : 0;
        await tx.mediaAsset.create({
          data: {
            id,
            storageKey: key,
            originalFilename: this.safeFilename(file.originalname, extension),
            mimeType: file.mimetype,
            mediaType: MediaType.IMAGE,
            sizeBytes: file.size,
            visibility: MediaVisibility.PUBLIC,
            status: MediaStatus.READY,
            createdByUserId: actorUserId,
          },
        });
        const attachment = await tx.destinationMedia.create({
          data: {
            destinationId,
            mediaId: id,
            role: dto.role,
            sortOrder,
            altText: this.optional(dto.altText),
            caption: this.optional(dto.caption),
          },
          select: adminMediaSelect,
        });
        await this.audit.record(tx, {
          ...context,
          action: replacedMediaId
            ? AUDIT_ACTIONS.ADMIN_DESTINATION_MEDIA_HERO_REPLACED
            : AUDIT_ACTIONS.ADMIN_DESTINATION_MEDIA_UPLOADED,
          actorUserId,
          entityId: destinationId,
          entityType: AUDIT_ENTITY_TYPES.DESTINATION,
          metadata: {
            destinationId,
            mediaId: id,
            mediaRole: dto.role,
            ...(replacedMediaId ? { previousMediaId: replacedMediaId } : {}),
          },
        });
        return this.toAdmin(destinationId, attachment);
      });
    } catch (error) {
      await this.cleanupFailedUpload(key, destinationId, id);
      throw error;
    }
  }

  private async cleanupFailedUpload(
    key: string,
    destinationId: string,
    mediaId: string,
  ): Promise<void> {
    try {
      await this.storage.deleteObject(key);
    } catch {
      this.logger.warn(
        `Destination media cleanup failed for destinationId=${destinationId}, mediaId=${mediaId}; manual cleanup may be required.`,
      );
    }
  }

  async update(
    destinationId: string,
    mediaId: string,
    actorUserId: string,
    dto: UpdateDestinationMediaDto,
    context: AuditContext,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const destination = await this.lockDestination(tx, destinationId);
      const existing = await this.findAttachment(tx, destinationId, mediaId);
      this.assertMutable(destination.status);
      if (existing.media.status === MediaStatus.ARCHIVED)
        throw new ConflictException(
          'Archived destination media cannot be edited.',
        );
      const item = await tx.destinationMedia.update({
        where: { destinationId_mediaId: { destinationId, mediaId } },
        data: {
          altText:
            dto.altText === undefined ? undefined : this.optional(dto.altText),
          caption:
            dto.caption === undefined ? undefined : this.optional(dto.caption),
        },
        select: adminMediaSelect,
      });
      await this.audit.record(tx, {
        ...context,
        action: AUDIT_ACTIONS.ADMIN_DESTINATION_MEDIA_UPDATED,
        actorUserId,
        entityId: destinationId,
        entityType: AUDIT_ENTITY_TYPES.DESTINATION,
        metadata: { destinationId, mediaId },
      });
      return this.toAdmin(destinationId, item);
    });
  }

  async archive(
    destinationId: string,
    mediaId: string,
    actorUserId: string,
    context: AuditContext,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const destination = await this.lockDestination(tx, destinationId);
      const existing = await this.findAttachment(tx, destinationId, mediaId);
      this.assertMutable(destination.status);
      if (existing.media.status === MediaStatus.ARCHIVED)
        throw new ConflictException('Destination media is already archived.');
      await tx.mediaAsset.update({
        where: { id: mediaId },
        data: { status: MediaStatus.ARCHIVED },
      });
      await this.audit.record(tx, {
        ...context,
        action: AUDIT_ACTIONS.ADMIN_DESTINATION_MEDIA_ARCHIVED,
        actorUserId,
        entityId: destinationId,
        entityType: AUDIT_ENTITY_TYPES.DESTINATION,
        metadata: { destinationId, mediaId },
      });
      return {
        ...this.toAdmin(destinationId, existing),
        status: MediaStatus.ARCHIVED,
      };
    });
  }

  async reorder(
    destinationId: string,
    actorUserId: string,
    dto: ReorderDestinationMediaDto,
    context: AuditContext,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const destination = await this.lockDestination(tx, destinationId);
      this.assertMutable(destination.status);
      if (new Set(dto.mediaIds).size !== dto.mediaIds.length)
        throw new BadRequestException('Gallery media IDs must be unique.');
      const active = await tx.destinationMedia.findMany({
        where: {
          destinationId,
          role: MediaRole.GALLERY,
          media: {
            status: MediaStatus.READY,
            visibility: MediaVisibility.PUBLIC,
            mediaType: MediaType.IMAGE,
          },
        },
        select: { mediaId: true },
      });
      if (
        active.length !== dto.mediaIds.length ||
        active.some((item) => !dto.mediaIds.includes(item.mediaId))
      )
        throw new BadRequestException(
          'Gallery order must contain every active gallery image exactly once.',
        );
      for (const [sortOrder, mediaId] of dto.mediaIds.entries()) {
        await tx.destinationMedia.update({
          where: { destinationId_mediaId: { destinationId, mediaId } },
          data: { sortOrder },
        });
      }
      await this.audit.record(tx, {
        ...context,
        action: AUDIT_ACTIONS.ADMIN_DESTINATION_MEDIA_REORDERED,
        actorUserId,
        entityId: destinationId,
        entityType: AUDIT_ENTITY_TYPES.DESTINATION,
        metadata: { destinationId, galleryCount: dto.mediaIds.length },
      });
      return { mediaIds: dto.mediaIds };
    });
  }

  async readAdminImage(destinationId: string, mediaId: string) {
    await this.requireDestination(destinationId);
    const attachment = await this.prisma.destinationMedia.findUnique({
      where: { destinationId_mediaId: { destinationId, mediaId } },
      select: {
        media: {
          select: {
            storageKey: true,
            mimeType: true,
            mediaType: true,
            status: true,
          },
        },
      },
    });
    if (
      !attachment ||
      attachment.media.mediaType !== MediaType.IMAGE ||
      !imageTypes.some((mime) => mime === attachment.media.mimeType) ||
      attachment.media.status === MediaStatus.FAILED ||
      attachment.media.status === MediaStatus.PENDING_UPLOAD
    )
      throw new NotFoundException('Destination image not found.');
    return {
      mimeType: attachment.media.mimeType,
      body: await this.storage.readObject(attachment.media.storageKey),
    };
  }

  private toAdmin(destinationId: string, item: AdminMediaRecord) {
    return {
      mediaId: item.mediaId,
      role: item.role,
      sortOrder: item.sortOrder,
      altText: item.altText,
      caption: item.caption,
      createdAt: item.createdAt,
      status: item.media.status,
      mediaType: item.media.mediaType,
      mimeType: item.media.mimeType,
      sizeBytes: item.media.sizeBytes,
      previewPath: `/api/v1/admin/destinations/${destinationId}/media/${item.mediaId}/content`,
    };
  }

  private async requireDestination(destinationId: string) {
    const destination = await this.prisma.destination.findUnique({
      where: { id: destinationId },
      select: { id: true, status: true },
    });
    if (!destination) throw new NotFoundException('Destination not found.');
    return destination;
  }

  private async requireMutableDestination(destinationId: string) {
    const destination = await this.requireDestination(destinationId);
    this.assertMutable(destination.status);
  }

  private async lockDestination(
    tx: Prisma.TransactionClient,
    destinationId: string,
  ) {
    const rows = await tx.$queryRaw<
      Array<{ id: string; status: PublicationStatus }>
    >`
      SELECT id, status FROM destinations WHERE id = ${destinationId}::uuid FOR UPDATE
    `;
    const destination = rows[0];
    if (!destination) throw new NotFoundException('Destination not found.');
    return destination;
  }

  private async lockMutableDestination(
    tx: Prisma.TransactionClient,
    destinationId: string,
  ) {
    const destination = await this.lockDestination(tx, destinationId);
    this.assertMutable(destination.status);
  }

  private assertMutable(status: PublicationStatus) {
    if (status === PublicationStatus.ARCHIVED)
      throw new ConflictException('Archived destinations cannot change media.');
  }

  private async findAttachment(
    tx: Prisma.TransactionClient,
    destinationId: string,
    mediaId: string,
  ) {
    const attachment = await tx.destinationMedia.findUnique({
      where: { destinationId_mediaId: { destinationId, mediaId } },
      select: adminMediaSelect,
    });
    if (!attachment)
      throw new NotFoundException('Destination media not found.');
    return attachment;
  }

  private assertImage(file: DestinationImageFile) {
    if (
      !file ||
      !Buffer.isBuffer(file.buffer) ||
      file.size < 1 ||
      file.size !== file.buffer.length
    )
      throw new BadRequestException('An image file is required.');
    if (file.size > MAX_IMAGE_BYTES)
      throw new BadRequestException(
        'Destination images must not exceed 10 MB.',
      );
    if (
      !imageTypes.some((mime) => mime === file.mimetype) ||
      !this.matchesSignature(file.buffer, file.mimetype)
    )
      throw new BadRequestException(
        'Only valid JPEG, PNG, and WebP images are allowed.',
      );
  }

  private matchesSignature(buffer: Buffer, mimeType: string) {
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
      filename
        .split(/[\\/]/)
        .pop()
        ?.replace(/[^A-Za-z0-9._-]/g, '_')
        .slice(0, 220) || 'upload';
    const stem = base.replace(/\.[^.]*$/, '') || 'upload';
    return `${stem}.${extension}`;
  }

  private optional(value: string | null | undefined) {
    return value?.trim() || null;
  }
}
