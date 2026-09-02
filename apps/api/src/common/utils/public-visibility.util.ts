import {
  BusinessStatus,
  BusinessVerificationSummary,
  LocationStatus,
  Prisma,
  PublicationStatus,
  ServiceStatus,
} from '@prisma/client';

export interface PublicLocationScope {
  regionSlug?: string;
  citySlug?: string;
  destinationSlug?: string;
  businessSlug?: string;
}

export function publicDestinationWhere(
  scope: PublicLocationScope = {},
): Prisma.DestinationWhereInput {
  return {
    status: PublicationStatus.PUBLISHED,
    slug: scope.destinationSlug,
    city: {
      slug: scope.citySlug,
      status: LocationStatus.ACTIVE,
      region: { slug: scope.regionSlug, status: LocationStatus.ACTIVE },
    },
  };
}

export function publicAttractionWhere(
  scope: PublicLocationScope = {},
): Prisma.AttractionWhereInput {
  return {
    status: PublicationStatus.PUBLISHED,
    destination: publicDestinationWhere(scope),
  };
}

export function publicBusinessWhere(
  scope: PublicLocationScope & { businessCategory?: string } = {},
): Prisma.BusinessWhereInput {
  return {
    slug: scope.businessSlug,
    status: BusinessStatus.ACTIVE,
    verificationSummary: BusinessVerificationSummary.VERIFIED,
    category: { isActive: true, code: scope.businessCategory },
    city: {
      slug: scope.citySlug,
      status: LocationStatus.ACTIVE,
      region: { slug: scope.regionSlug, status: LocationStatus.ACTIVE },
    },
    destination: scope.destinationSlug
      ? { slug: scope.destinationSlug, status: PublicationStatus.PUBLISHED }
      : undefined,
    OR: [
      { destinationId: null },
      { destination: { status: PublicationStatus.PUBLISHED } },
    ],
  };
}

export function publicServiceWhere(
  scope: PublicLocationScope & {
    businessCategory?: string;
    serviceCategory?: string;
  } = {},
): Prisma.ServiceWhereInput {
  return {
    status: ServiceStatus.PUBLISHED,
    category: { isActive: true, code: scope.serviceCategory },
    business: publicBusinessWhere(scope),
  };
}
