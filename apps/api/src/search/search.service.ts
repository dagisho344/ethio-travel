import { BadRequestException, Injectable } from '@nestjs/common';
import { PricingModel, Prisma, ServiceLocationMode } from '@prisma/client';
import { paginate, PaginatedResponse } from '../common/dto/pagination.dto';
import {
  haversineDistanceKm,
  hasNearbyCoordinates,
  MAX_DISCOVERY_RESULT_WINDOW,
  nearbyRadiusKm,
  radiusBounds,
  validateNearbyCoordinates,
  validatePublicDiscoveryScope,
} from '../common/utils/public-discovery.util';
import {
  publicAttractionWhere,
  publicBusinessWhere,
  publicDestinationWhere,
  publicServiceWhere,
} from '../common/utils/public-visibility.util';
import { PrismaService } from '../prisma/prisma.service';
import {
  SearchEntityType,
  SearchQueryDto,
  SearchSort,
} from './dto/search-query.dto';

interface SearchLocation {
  region?: { name: string; slug: string };
  city?: { name: string; slug: string };
  destination?: { name: string; slug: string } | null;
  business?: { name: string; slug: string };
}

export interface SearchResult {
  type: SearchEntityType;
  id: string;
  name: string;
  slug: string;
  shortDescription?: string;
  latitude: Prisma.Decimal | null;
  longitude: Prisma.Decimal | null;
  category?: { code?: string; name: string };
  location: SearchLocation;
  price?: Prisma.Decimal | null;
  currency?: string | null;
  pricingModel?: PricingModel;
  distanceKm?: number;
  createdAt: Date;
  relevance: number;
}

const destinationSelect = {
  id: true,
  name: true,
  slug: true,
  shortDescription: true,
  fullDescription: true,
  latitude: true,
  longitude: true,
  createdAt: true,
  city: {
    select: {
      name: true,
      slug: true,
      region: { select: { name: true, slug: true } },
    },
  },
} satisfies Prisma.DestinationSelect;

const attractionSelect = {
  id: true,
  name: true,
  slug: true,
  category: true,
  description: true,
  latitude: true,
  longitude: true,
  createdAt: true,
  destination: {
    select: {
      name: true,
      slug: true,
      city: {
        select: {
          name: true,
          slug: true,
          region: { select: { name: true, slug: true } },
        },
      },
    },
  },
} satisfies Prisma.AttractionSelect;

const businessSelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  addressLine1: true,
  neighborhood: true,
  latitude: true,
  longitude: true,
  createdAt: true,
  category: { select: { code: true, name: true } },
  city: {
    select: {
      name: true,
      slug: true,
      region: { select: { name: true, slug: true } },
    },
  },
  destination: { select: { name: true, slug: true } },
} satisfies Prisma.BusinessSelect;

const serviceSelect = {
  id: true,
  name: true,
  slug: true,
  shortDescription: true,
  description: true,
  latitude: true,
  longitude: true,
  locationMode: true,
  price: true,
  currency: true,
  pricingModel: true,
  createdAt: true,
  category: { select: { code: true, name: true } },
  business: {
    select: {
      name: true,
      slug: true,
      latitude: true,
      longitude: true,
      city: {
        select: {
          name: true,
          slug: true,
          region: { select: { name: true, slug: true } },
        },
      },
      destination: { select: { name: true, slug: true } },
    },
  },
} satisfies Prisma.ServiceSelect;

type DestinationRecord = Prisma.DestinationGetPayload<{
  select: typeof destinationSelect;
}>;
type AttractionRecord = Prisma.AttractionGetPayload<{
  select: typeof attractionSelect;
}>;
type BusinessRecord = Prisma.BusinessGetPayload<{
  select: typeof businessSelect;
}>;
type ServiceRecord = Prisma.ServiceGetPayload<{
  select: typeof serviceSelect;
}>;

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(
    query: SearchQueryDto,
  ): Promise<
    PaginatedResponse<
      Omit<SearchResult, 'createdAt' | 'relevance'> & Record<string, unknown>
    >
  > {
    this.validateQuery(query);
    const normalized = { ...query, q: query.q?.trim() };
    const types = this.resolveTypes(normalized);
    const isNearbySearch = hasNearbyCoordinates(normalized);
    const take = isNearbySearch
      ? MAX_DISCOVERY_RESULT_WINDOW + 1
      : normalized.page * normalized.limit;
    const [items, total] = await Promise.all([
      this.collectResults(normalized, types, take),
      isNearbySearch
        ? Promise.resolve(0)
        : this.countResults(normalized, types),
    ]);
    if (isNearbySearch && items.length > MAX_DISCOVERY_RESULT_WINDOW) {
      throw new BadRequestException(
        `Nearby searches are limited to ${MAX_DISCOVERY_RESULT_WINDOW} candidates. Narrow the search or choose a smaller radius.`,
      );
    }
    const nearbyItems = this.applyNearbyFilter(items, normalized);
    const sorted = this.sortResults(nearbyItems, normalized.sort);
    const boundedTotal = isNearbySearch ? sorted.length : total;
    const pageItems = sorted.slice(
      (normalized.page - 1) * normalized.limit,
      normalized.page * normalized.limit,
    );
    return paginate(
      pageItems.map((item) => this.toResponseItem(item)),
      boundedTotal,
      normalized.page,
      normalized.limit,
    );
  }

  private toResponseItem(
    item: SearchResult,
  ): Omit<SearchResult, 'createdAt' | 'relevance'> {
    return {
      type: item.type,
      id: item.id,
      name: item.name,
      slug: item.slug,
      shortDescription: item.shortDescription,
      latitude: item.latitude,
      longitude: item.longitude,
      category: item.category,
      location: item.location,
      price: item.price,
      currency: item.currency,
      pricingModel: item.pricingModel,
      distanceKm: item.distanceKm,
    };
  }
  private async collectResults(
    query: SearchQueryDto,
    types: SearchEntityType[],
    take: number,
  ): Promise<SearchResult[]> {
    const tasks: Promise<SearchResult[]>[] = [];
    if (types.includes(SearchEntityType.DESTINATION))
      tasks.push(this.findDestinations(query, take));
    if (types.includes(SearchEntityType.ATTRACTION))
      tasks.push(this.findAttractions(query, take));
    if (types.includes(SearchEntityType.BUSINESS))
      tasks.push(this.findBusinesses(query, take));
    if (types.includes(SearchEntityType.SERVICE))
      tasks.push(this.findServices(query, take));
    return (await Promise.all(tasks)).flat();
  }

  private async countResults(
    query: SearchQueryDto,
    types: SearchEntityType[],
  ): Promise<number> {
    const tasks: Promise<number>[] = [];
    if (types.includes(SearchEntityType.DESTINATION))
      tasks.push(
        this.prisma.destination.count({ where: this.destinationWhere(query) }),
      );
    if (types.includes(SearchEntityType.ATTRACTION))
      tasks.push(
        this.prisma.attraction.count({ where: this.attractionWhere(query) }),
      );
    if (types.includes(SearchEntityType.BUSINESS))
      tasks.push(
        this.prisma.business.count({ where: this.businessWhere(query) }),
      );
    if (types.includes(SearchEntityType.SERVICE))
      tasks.push(
        this.prisma.service.count({ where: this.serviceWhere(query) }),
      );
    return (await Promise.all(tasks)).reduce((sum, count) => sum + count, 0);
  }

  private findDestinations(
    query: SearchQueryDto,
    take: number,
  ): Promise<SearchResult[]> {
    return this.prisma.destination
      .findMany({
        where: this.destinationWhere(query),
        select: destinationSelect,
        orderBy: this.orderBy(query.sort),
        take,
      })
      .then((records) =>
        records.map((record) => this.mapDestination(record, query.q)),
      );
  }

  private findAttractions(
    query: SearchQueryDto,
    take: number,
  ): Promise<SearchResult[]> {
    return this.prisma.attraction
      .findMany({
        where: this.attractionWhere(query),
        select: attractionSelect,
        orderBy: this.orderBy(query.sort),
        take,
      })
      .then((records) =>
        records.map((record) => this.mapAttraction(record, query.q)),
      );
  }

  private findBusinesses(
    query: SearchQueryDto,
    take: number,
  ): Promise<SearchResult[]> {
    return this.prisma.business
      .findMany({
        where: this.businessWhere(query),
        select: businessSelect,
        orderBy: this.orderBy(query.sort),
        take,
      })
      .then((records) =>
        records.map((record) => this.mapBusiness(record, query.q)),
      );
  }

  private findServices(
    query: SearchQueryDto,
    take: number,
  ): Promise<SearchResult[]> {
    return this.prisma.service
      .findMany({
        where: this.serviceWhere(query),
        select: serviceSelect,
        orderBy: this.serviceOrderBy(query.sort),
        take,
      })
      .then((records) =>
        records.map((record) => this.mapService(record, query.q)),
      );
  }

  private destinationWhere(
    query: SearchQueryDto,
  ): Prisma.DestinationWhereInput {
    return {
      AND: [
        publicDestinationWhere(query),
        this.destinationText(query.q),
        this.nearbyCoordinatesWhere(query),
      ],
    };
  }

  private attractionWhere(query: SearchQueryDto): Prisma.AttractionWhereInput {
    return {
      AND: [
        publicAttractionWhere(query),
        this.attractionText(query.q),
        this.nearbyCoordinatesWhere(query),
      ],
    };
  }

  private businessWhere(query: SearchQueryDto): Prisma.BusinessWhereInput {
    return {
      AND: [
        publicBusinessWhere(query),
        this.businessText(query.q),
        this.nearbyCoordinatesWhere(query),
      ],
    };
  }

  private serviceWhere(query: SearchQueryDto): Prisma.ServiceWhereInput {
    return {
      AND: [
        publicServiceWhere(query),
        {
          pricingModel: query.pricingModel,
          currency: query.currency,
          price:
            query.minPrice !== undefined || query.maxPrice !== undefined
              ? { gte: query.minPrice, lte: query.maxPrice }
              : undefined,
        },
        this.serviceText(query.q),
        this.serviceNearbyCoordinatesWhere(query),
      ],
    };
  }

  private nearbyCoordinatesWhere(query: SearchQueryDto): {
    latitude?: { gte: number; lte: number };
    longitude?: { gte: number; lte: number };
  } {
    if (!hasNearbyCoordinates(query)) return {};
    const bounds = radiusBounds(query.lat, query.lng, nearbyRadiusKm(query));
    return {
      latitude: { gte: bounds.south, lte: bounds.north },
      longitude: { gte: bounds.west, lte: bounds.east },
    };
  }

  private serviceNearbyCoordinatesWhere(
    query: SearchQueryDto,
  ): Prisma.ServiceWhereInput {
    const bounds = this.nearbyCoordinatesWhere(query);
    if (!bounds.latitude || !bounds.longitude) return {};
    return {
      OR: [
        {
          locationMode: ServiceLocationMode.BUSINESS_LOCATION,
          business: bounds,
        },
        {
          locationMode: {
            in: [
              ServiceLocationMode.CUSTOM_LOCATION,
              ServiceLocationMode.MOBILE_VARIABLE,
            ],
          },
          ...bounds,
        },
      ],
    };
  }
  private destinationText(q?: string): Prisma.DestinationWhereInput {
    return q
      ? {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { shortDescription: { contains: q, mode: 'insensitive' } },
            { fullDescription: { contains: q, mode: 'insensitive' } },
            { city: { name: { contains: q, mode: 'insensitive' } } },
            {
              city: {
                region: { name: { contains: q, mode: 'insensitive' } },
              },
            },
          ],
        }
      : {};
  }

  private attractionText(q?: string): Prisma.AttractionWhereInput {
    return q
      ? {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
            { destination: { name: { contains: q, mode: 'insensitive' } } },
            {
              destination: {
                city: { name: { contains: q, mode: 'insensitive' } },
              },
            },
            {
              destination: {
                city: {
                  region: { name: { contains: q, mode: 'insensitive' } },
                },
              },
            },
          ],
        }
      : {};
  }

  private businessText(q?: string): Prisma.BusinessWhereInput {
    return q
      ? {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
            { addressLine1: { contains: q, mode: 'insensitive' } },
            { neighborhood: { contains: q, mode: 'insensitive' } },
            { city: { name: { contains: q, mode: 'insensitive' } } },
            {
              city: {
                region: { name: { contains: q, mode: 'insensitive' } },
              },
            },
            { destination: { name: { contains: q, mode: 'insensitive' } } },
          ],
        }
      : {};
  }

  private serviceText(q?: string): Prisma.ServiceWhereInput {
    return q
      ? {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { shortDescription: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
            { business: { name: { contains: q, mode: 'insensitive' } } },
            {
              business: {
                city: { name: { contains: q, mode: 'insensitive' } },
              },
            },
            {
              business: {
                city: {
                  region: { name: { contains: q, mode: 'insensitive' } },
                },
              },
            },
            {
              business: {
                destination: { name: { contains: q, mode: 'insensitive' } },
              },
            },
          ],
        }
      : {};
  }

  private orderBy(
    sort: SearchSort,
  ): Prisma.DestinationOrderByWithRelationInput[] {
    if (sort === SearchSort.NAME_DESC) return [{ name: 'desc' }, { id: 'asc' }];
    if (sort === SearchSort.NEWEST)
      return [{ createdAt: 'desc' }, { id: 'asc' }];
    return [{ name: 'asc' }, { id: 'asc' }];
  }

  private serviceOrderBy(
    sort: SearchSort,
  ): Prisma.ServiceOrderByWithRelationInput[] {
    if (sort === SearchSort.NAME_DESC) return [{ name: 'desc' }, { id: 'asc' }];
    if (sort === SearchSort.NEWEST)
      return [{ createdAt: 'desc' }, { id: 'asc' }];
    return [{ name: 'asc' }, { id: 'asc' }];
  }

  private sortResults(items: SearchResult[], sort: SearchSort): SearchResult[] {
    const copy = [...items];
    return copy.sort((left, right) => {
      if (sort === SearchSort.NEWEST)
        return (
          right.createdAt.getTime() - left.createdAt.getTime() ||
          this.nameCompare(left, right)
        );
      if (sort === SearchSort.NAME_DESC)
        return (
          right.name.localeCompare(left.name) || this.typeCompare(left, right)
        );
      if (sort === SearchSort.NAME_ASC) return this.nameCompare(left, right);
      if (sort === SearchSort.DISTANCE)
        return (
          (left.distanceKm ?? Number.POSITIVE_INFINITY) -
            (right.distanceKm ?? Number.POSITIVE_INFINITY) ||
          this.nameCompare(left, right)
        );
      return right.relevance - left.relevance || this.nameCompare(left, right);
    });
  }
  private nameCompare(left: SearchResult, right: SearchResult): number {
    return left.name.localeCompare(right.name) || this.typeCompare(left, right);
  }

  private typeCompare(left: SearchResult, right: SearchResult): number {
    return (
      left.type.localeCompare(right.type) || left.id.localeCompare(right.id)
    );
  }

  private relevance(name: string, q?: string): number {
    if (!q) return 0;
    return name.toLowerCase().includes(q.toLowerCase()) ? 2 : 1;
  }

  private applyNearbyFilter(
    items: SearchResult[],
    query: SearchQueryDto,
  ): SearchResult[] {
    if (!hasNearbyCoordinates(query)) return items;
    const radiusKm = nearbyRadiusKm(query);
    return items.flatMap((item) => {
      if (item.latitude === null || item.longitude === null) return [];
      const distanceKm = haversineDistanceKm(
        query.lat,
        query.lng,
        item.latitude,
        item.longitude,
      );
      return distanceKm <= radiusKm ? [{ ...item, distanceKm }] : [];
    });
  }

  private resolveTypes(query: SearchQueryDto): SearchEntityType[] {
    const hasServiceFilter = Boolean(
      query.serviceCategory ||
      query.pricingModel ||
      query.currency ||
      query.minPrice !== undefined ||
      query.maxPrice !== undefined,
    );
    const requested = query.types;
    if (hasServiceFilter) {
      if (
        requested &&
        (requested.length !== 1 || requested[0] !== SearchEntityType.SERVICE)
      ) {
        throw new BadRequestException('Service filters require types=service.');
      }
      return [SearchEntityType.SERVICE];
    }
    if (query.businessCategory) {
      if (
        requested &&
        requested.some(
          (type) =>
            type !== SearchEntityType.BUSINESS &&
            type !== SearchEntityType.SERVICE,
        )
      ) {
        throw new BadRequestException(
          'businessCategory applies only to business and service results.',
        );
      }
      return requested ?? [SearchEntityType.BUSINESS, SearchEntityType.SERVICE];
    }
    return requested ?? Object.values(SearchEntityType);
  }

  private validateQuery(query: SearchQueryDto): void {
    validatePublicDiscoveryScope(query);
    validateNearbyCoordinates(query);
    if (query.q) query.q = query.q.trim();
    if (
      query.minPrice !== undefined &&
      query.maxPrice !== undefined &&
      query.minPrice > query.maxPrice
    ) {
      throw new BadRequestException('minPrice cannot exceed maxPrice.');
    }
    if (
      (query.minPrice !== undefined || query.maxPrice !== undefined) &&
      (!query.pricingModel || !query.currency)
    ) {
      throw new BadRequestException(
        'Price ranges require both pricingModel and currency.',
      );
    }
    if (query.sort === SearchSort.DISTANCE && !hasNearbyCoordinates(query)) {
      throw new BadRequestException('sort=distance requires lat and lng.');
    }
    if (query.page * query.limit > MAX_DISCOVERY_RESULT_WINDOW) {
      throw new BadRequestException(
        `Search pages are limited to the first ${MAX_DISCOVERY_RESULT_WINDOW} results.`,
      );
    }
    this.resolveTypes(query);
  }

  private mapDestination(record: DestinationRecord, q?: string): SearchResult {
    return {
      type: SearchEntityType.DESTINATION,
      id: record.id,
      name: record.name,
      slug: record.slug,
      shortDescription: record.shortDescription,
      latitude: record.latitude,
      longitude: record.longitude,
      location: {
        city: { name: record.city.name, slug: record.city.slug },
        region: {
          name: record.city.region.name,
          slug: record.city.region.slug,
        },
      },
      createdAt: record.createdAt,
      relevance: this.relevance(record.name, q),
    };
  }

  private mapAttraction(record: AttractionRecord, q?: string): SearchResult {
    return {
      type: SearchEntityType.ATTRACTION,
      id: record.id,
      name: record.name,
      slug: record.slug,
      shortDescription: record.description,
      latitude: record.latitude,
      longitude: record.longitude,
      category: { name: record.category },
      location: {
        destination: {
          name: record.destination.name,
          slug: record.destination.slug,
        },
        city: {
          name: record.destination.city.name,
          slug: record.destination.city.slug,
        },
        region: {
          name: record.destination.city.region.name,
          slug: record.destination.city.region.slug,
        },
      },
      createdAt: record.createdAt,
      relevance: this.relevance(record.name, q),
    };
  }

  private mapBusiness(record: BusinessRecord, q?: string): SearchResult {
    return {
      type: SearchEntityType.BUSINESS,
      id: record.id,
      name: record.name,
      slug: record.slug,
      shortDescription: record.description,
      latitude: record.latitude,
      longitude: record.longitude,
      category: { code: record.category.code, name: record.category.name },
      location: {
        destination: record.destination
          ? { name: record.destination.name, slug: record.destination.slug }
          : null,
        city: { name: record.city.name, slug: record.city.slug },
        region: {
          name: record.city.region.name,
          slug: record.city.region.slug,
        },
      },
      createdAt: record.createdAt,
      relevance: this.relevance(record.name, q),
    };
  }

  private mapService(record: ServiceRecord, q?: string): SearchResult {
    const businessCoords = record.locationMode === 'BUSINESS_LOCATION';
    return {
      type: SearchEntityType.SERVICE,
      id: record.id,
      name: record.name,
      slug: record.slug,
      shortDescription: record.shortDescription,
      latitude: businessCoords ? record.business.latitude : record.latitude,
      longitude: businessCoords ? record.business.longitude : record.longitude,
      category: { code: record.category.code, name: record.category.name },
      location: {
        business: { name: record.business.name, slug: record.business.slug },
        destination: record.business.destination
          ? {
              name: record.business.destination.name,
              slug: record.business.destination.slug,
            }
          : null,
        city: {
          name: record.business.city.name,
          slug: record.business.city.slug,
        },
        region: {
          name: record.business.city.region.name,
          slug: record.business.city.region.slug,
        },
      },
      price: record.price,
      currency: record.currency,
      pricingModel: record.pricingModel,
      createdAt: record.createdAt,
      relevance: this.relevance(record.name, q),
    };
  }
}
