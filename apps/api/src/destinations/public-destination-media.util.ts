import {
  MediaRole,
  MediaStatus,
  MediaType,
  MediaVisibility,
  Prisma,
} from '@prisma/client';

export const MAX_PUBLIC_DESTINATION_GALLERY = 12;

export const publicDestinationMediaSelect = {
  role: true,
  sortOrder: true,
  altText: true,
  caption: true,
  media: { select: { id: true, mimeType: true } },
} satisfies Prisma.DestinationMediaSelect;

export type PublicDestinationMediaRecord = Prisma.DestinationMediaGetPayload<{
  select: typeof publicDestinationMediaSelect;
}>;

export const publicHeroMedia = {
  where: {
    role: MediaRole.HERO,
    media: {
      status: MediaStatus.READY,
      visibility: MediaVisibility.PUBLIC,
      mediaType: MediaType.IMAGE,
      mimeType: { in: ['image/jpeg', 'image/png', 'image/webp'] },
    },
  },
  orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  take: 1,
  select: publicDestinationMediaSelect,
} satisfies Prisma.DestinationMediaFindManyArgs;

export const publicGalleryMedia = {
  where: {
    role: MediaRole.GALLERY,
    media: {
      status: MediaStatus.READY,
      visibility: MediaVisibility.PUBLIC,
      mediaType: MediaType.IMAGE,
      mimeType: { in: ['image/jpeg', 'image/png', 'image/webp'] },
    },
  },
  orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
  take: MAX_PUBLIC_DESTINATION_GALLERY,
  select: publicDestinationMediaSelect,
} satisfies Prisma.DestinationMediaFindManyArgs;

export function toPublicDestinationMedia(item: PublicDestinationMediaRecord) {
  return {
    id: item.media.id,
    role: item.role,
    sortOrder: item.sortOrder,
    altText: item.altText,
    caption: item.caption,
    mediaType: MediaType.IMAGE,
    mimeType: item.media.mimeType,
    accessPath: `/api/v1/media/public/${item.media.id}`,
  };
}
