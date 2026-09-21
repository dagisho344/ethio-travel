export type PublicServiceCategoryFamily =
  'ACCOMMODATION' | 'RESTAURANT' | 'TOUR' | 'TRANSPORT' | 'OTHER';

export type PublicServiceCategoryPresentation = {
  description: string;
  href: string;
  label: string;
  sectionLabel: string;
};

const presentations: Record<
  Exclude<PublicServiceCategoryFamily, 'OTHER'>,
  PublicServiceCategoryPresentation
> = {
  ACCOMMODATION: {
    description:
      'Browse verified stays and accommodation services across Ethiopia.',
    href: '/hotels',
    label: 'Hotels',
    sectionLabel: 'Accommodation details',
  },
  RESTAURANT: {
    description:
      'Discover verified restaurants and dining services for your journey.',
    href: '/restaurants',
    label: 'Restaurants',
    sectionLabel: 'Restaurant details',
  },
  TOUR: {
    description: 'Explore verified guided tours and local experiences.',
    href: '/tours',
    label: 'Tours',
    sectionLabel: 'Tour details',
  },
  TRANSPORT: {
    description:
      'Find verified transport services and scheduled travel options.',
    href: '/transport',
    label: 'Transport',
    sectionLabel: 'Transport details',
  },
};

export function getPublicServiceCategoryPresentation(
  family: string | null | undefined,
): PublicServiceCategoryPresentation | null {
  switch (family) {
    case 'ACCOMMODATION':
    case 'RESTAURANT':
    case 'TOUR':
    case 'TRANSPORT':
      return presentations[family];
    default:
      return null;
  }
}
