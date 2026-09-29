import { EditorialLocale, Prisma } from '@prisma/client';

// ECMAScript String.trim whitespace. PostgreSQL's default btrim only removes
// ordinary spaces; bind this same character set for public SQL completeness.
export const EDITORIAL_TRIM_CHARACTERS =
  '\u0009\u000a\u000b\u000c\u000d\u0020\u00a0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u2028\u2029\u202f\u205f\u3000\ufeff';

export function nonEmptyEditorialText(
  value: string | null | undefined,
): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

export function isDestinationTranslationComplete(translation: {
  shortDescription: string | null;
  fullDescription: string | null;
}): boolean {
  return Boolean(
    nonEmptyEditorialText(translation.shortDescription) &&
    nonEmptyEditorialText(translation.fullDescription),
  );
}

export const publishedAmharicEditorial = {
  where: { locale: EditorialLocale.am, isPublished: true },
  select: {
    displayName: true,
    shortDescription: true,
    fullDescription: true,
    isPublished: true,
    bestTimeToVisit: true,
    gettingThere: true,
    localTips: true,
    safetyNotes: true,
  },
  take: 1,
} satisfies Prisma.DestinationTranslationFindManyArgs;

export const publishedAmharicDiscoveryEditorial = {
  where: publishedAmharicEditorial.where,
  select: {
    displayName: true,
    shortDescription: true,
    fullDescription: true,
    isPublished: true,
  },
  take: 1,
} satisfies Prisma.DestinationTranslationFindManyArgs;

export type PublicDestinationEditorialTranslation =
  Prisma.DestinationTranslationGetPayload<{
    select: typeof publishedAmharicDiscoveryEditorial.select;
  }> &
    Partial<
      Pick<
        Prisma.DestinationTranslationUncheckedCreateInput,
        'bestTimeToVisit' | 'gettingThere' | 'localTips' | 'safetyNotes'
      >
    >;

export function eligibleAmharicEditorial(
  locale: EditorialLocale | undefined,
  translation: PublicDestinationEditorialTranslation | undefined,
): PublicDestinationEditorialTranslation | undefined {
  return locale === EditorialLocale.am &&
    translation?.isPublished &&
    isDestinationTranslationComplete(translation)
    ? translation
    : undefined;
}

type EditorialSource = {
  name: string;
  shortDescription?: string;
  fullDescription?: string;
  travelInfo?: Prisma.JsonValue | null;
};

/** F1 output boundary, reused by Destination, Search and Map presentation. */
export function resolvePublicDestinationEditorial<T extends EditorialSource>(
  source: T,
  locale: EditorialLocale | undefined,
  candidate: PublicDestinationEditorialTranslation | undefined,
): T {
  const translation = eligibleAmharicEditorial(locale, candidate);
  if (!translation) return source;
  const travelInfo: Record<string, string> = {};
  for (const field of [
    'bestTimeToVisit',
    'gettingThere',
    'localTips',
    'safetyNotes',
  ] as const) {
    const value = nonEmptyEditorialText(translation[field]);
    if (value) travelInfo[field] = value;
  }
  const originalTravel = source.travelInfo;
  const resolvedTravel =
    Object.keys(travelInfo).length === 0
      ? originalTravel
      : originalTravel &&
          typeof originalTravel === 'object' &&
          !Array.isArray(originalTravel)
        ? { ...originalTravel, ...travelInfo }
        : travelInfo;
  return {
    ...source,
    name: nonEmptyEditorialText(translation.displayName) ?? source.name,
    ...(source.shortDescription !== undefined
      ? {
          shortDescription: nonEmptyEditorialText(
            translation.shortDescription,
          )!,
        }
      : {}),
    ...(source.fullDescription !== undefined
      ? { fullDescription: nonEmptyEditorialText(translation.fullDescription)! }
      : {}),
    ...(source.travelInfo !== undefined ? { travelInfo: resolvedTravel } : {}),
  };
}

/** Fixed dt alias. Publication/completeness is identical to F1's trim rule. */
export function publicAmharicEditorialSql(): Prisma.Sql {
  return Prisma.sql`dt.locale = ${EditorialLocale.am}::"EditorialLocale" AND dt.is_published = TRUE
    AND NULLIF(btrim(dt.short_description, ${EDITORIAL_TRIM_CHARACTERS}), '') IS NOT NULL
    AND NULLIF(btrim(dt.full_description, ${EDITORIAL_TRIM_CHARACTERS}), '') IS NOT NULL`;
}

/** Typed predicate carrier: am must be executed through ranked IDs, whose
 * EXISTS compiler enforces exact F1 completeness before count/order/window.
 * Prisma hydration rechecks this carrier ONLY against already-qualified IDs.
 */
export function destinationDiscoveryText(
  q: string | undefined,
  locale: EditorialLocale | undefined,
): Prisma.DestinationWhereInput {
  if (!q) return {};
  const canonical: Prisma.DestinationWhereInput = {
    OR: [
      { name: { contains: q, mode: 'insensitive' } },
      { shortDescription: { contains: q, mode: 'insensitive' } },
      { fullDescription: { contains: q, mode: 'insensitive' } },
      { city: { name: { contains: q, mode: 'insensitive' } } },
      { city: { region: { name: { contains: q, mode: 'insensitive' } } } },
    ],
  };
  return locale === EditorialLocale.am
    ? {
        OR: [
          canonical,
          {
            translations: {
              some: {
                locale: EditorialLocale.am,
                isPublished: true,
                OR: [
                  { displayName: { contains: q, mode: 'insensitive' } },
                  { shortDescription: { contains: q, mode: 'insensitive' } },
                ],
              },
            },
          },
        ],
      }
    : canonical;
}
