import { EditorialLocale, Prisma } from '@prisma/client';
import { nonEmptyEditorialText } from '../destinations/public-destination-editorial.util';

export const publicRegionSelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.RegionSelect;

export const publishedAmharicRegionEditorial = {
  where: { locale: EditorialLocale.am, isPublished: true },
  select: {
    locale: true,
    displayName: true,
    description: true,
    isPublished: true,
  },
  take: 1,
} satisfies Prisma.RegionTranslationFindManyArgs;

export const localizedPublicRegionSelect = {
  ...publicRegionSelect,
  translations: publishedAmharicRegionEditorial,
} satisfies Prisma.RegionSelect;

export type PublicRegion = Prisma.RegionGetPayload<{
  select: typeof publicRegionSelect;
}>;

export type PublicRegionEditorialTranslation =
  Prisma.RegionTranslationGetPayload<{
    select: typeof publishedAmharicRegionEditorial.select;
  }>;

export function isRegionTranslationComplete(
  source: { description: string | null },
  translation: { displayName: string | null; description: string | null },
): boolean {
  return Boolean(
    nonEmptyEditorialText(translation.displayName) &&
    (!nonEmptyEditorialText(source.description) ||
      nonEmptyEditorialText(translation.description)),
  );
}

/** Identity comes from the source; incomplete prose never gets a partial overlay. */
export function resolvePublicRegionEditorial<
  T extends {
    name: string;
    description: string | null;
  },
>(
  source: T,
  locale: EditorialLocale | undefined,
  translation: PublicRegionEditorialTranslation | undefined,
): T {
  if (
    locale !== EditorialLocale.am ||
    translation?.locale !== EditorialLocale.am ||
    !translation.isPublished ||
    !isRegionTranslationComplete(source, translation)
  )
    return source;

  return {
    ...source,
    name: nonEmptyEditorialText(translation.displayName)!,
    // When the source has no prose, only approved optional translated prose is
    // added. Empty optional prose becomes null, never a mixed English paragraph.
    description: nonEmptyEditorialText(translation.description),
  };
}
