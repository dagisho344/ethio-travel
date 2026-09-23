import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, ReviewStatus, ServiceLocationMode } from '@prisma/client';
import {
  hasNearbyCoordinates,
  haversineDistanceKm,
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
import { SearchEntityType } from '../search/dto/search-query.dto';
import { MapPlacesQueryDto } from './dto/map-places-query.dto';

export interface MapMarker {
  type: SearchEntityType;
  id: string;
  name: string;
  slug: string;
  latitude: Prisma.Decimal;
  longitude: Prisma.Decimal;
  category?: { code?: string; name: string };
  location: {
    region?: { name: string; slug: string };
    city?: { name: string; slug: string };
    destination?: { name: string; slug: string } | null;
    business?: { name: string; slug: string };
  };
  rating?: { average: number; count: number };
  distanceKm?: number;
}

const destinationSelect = {
  id: true,
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
} satisfies Prisma.DestinationSelect;

const attractionSelect = {
  id: true,
  name: true,
  slug: true,
  category: true,
  latitude: true,
  longitude: true,
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
  latitude: true,
  longitude: true,
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
  latitude: true,
  longitude: true,
  locationMode: true,
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
export class MapsService {
  constructor(private readonly prisma: PrismaService) {}

  async findPlaces(query: MapPlacesQueryDto): Promise<{ data: MapMarker[] }> {
    this.validateQuery(query);
    const types = this.resolveTypes(query);
    const isNearbySearch = hasNearbyCoordinates(query);
    const candidateLimit = isNearbySearch
      ? MAX_DISCOVERY_RESULT_WINDOW + 1
      : query.limit;
    const batches = await Promise.all([
      types.includes(SearchEntityType.DESTINATION)
        ? this.destinations(query, candidateLimit)
        : Promise.resolve([]),
      types.includes(SearchEntityType.ATTRACTION)
        ? this.attractions(query, candidateLimit)
        : Promise.resolve([]),
      types.includes(SearchEntityType.BUSINESS)
        ? this.businesses(query, candidateLimit)
        : Promise.resolve([]),
      types.includes(SearchEntityType.SERVICE)
        ? this.services(query, candidateLimit)
        : Promise.resolve([]),
    ]);
    const candidates = isNearbySearch
      ? batches.flat()
      : this.fairMerge(batches, query.limit);
    if (isNearbySearch && candidates.length > MAX_DISCOVERY_RESULT_WINDOW) {
      throw new BadRequestException(
        `Nearby map searches are limited to ${MAX_DISCOVERY_RESULT_WINDOW} candidates. Narrow the search or choose a smaller radius.`,
      );
    }
    const markers = this.filterNearby(candidates, query);
    const boundedMarkers = isNearbySearch
      ? this.sortNearby(markers).slice(0, query.limit)
      : markers;
    return { data: await this.withRatings(boundedMarkers) };
  }

  private destinations(
    query: MapPlacesQueryDto,
    take: number,
  ): Promise<MapMarker[]> {
    return this.prisma.destination
      .findMany({
        where: {
          AND: [
            publicDestinationWhere(query),
            this.destinationText(query.q),
            this.bboxWhere(query),
          ],
        },
        select: destinationSelect,
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        take,
      })
      .then((records) => records.map((record) => this.mapDestination(record)));
  }

  private attractions(
    query: MapPlacesQueryDto,
    take: number,
  ): Promise<MapMarker[]> {
    return this.prisma.attraction
      .findMany({
        where: {
          AND: [
            publicAttractionWhere(query),
            this.attractionText(query.q),
            this.bboxWhere(query),
          ],
        },
        select: attractionSelect,
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        take,
      })
      .then((records) => records.map((record) => this.mapAttraction(record)));
  }

  private businesses(
    query: MapPlacesQueryDto,
    take: number,
  ): Promise<MapMarker[]> {
    return this.prisma.business
      .findMany({
        where: {
          AND: [
            publicBusinessWhere(query),
            this.businessText(query.q),
            this.bboxWhere(query),
          ],
        },
        select: businessSelect,
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        take,
      })
      .then((records) => records.map((record) => this.mapBusiness(record)));
  }

  private services(
    query: MapPlacesQueryDto,
    take: number,
  ): Promise<MapMarker[]> {
    return this.prisma.service
      .findMany({
        where: this.serviceWhere(query),
        select: serviceSelect,
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        take,
      })
      .then((records) => records.flatMap((record) => this.mapService(record)));
  }

  private serviceWhere(query: MapPlacesQueryDto): Prisma.ServiceWhereInput {
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
        {
          OR: [
            {
              locationMode: ServiceLocationMode.BUSINESS_LOCATION,
              business: this.bboxWhere(query),
            },
            {
              locationMode: ServiceLocationMode.CUSTOM_LOCATION,
              ...this.bboxWhere(query),
            },
            {
              locationMode: ServiceLocationMode.MOBILE_VARIABLE,
              ...this.bboxWhere(query),
            },
          ],
        },
      ],
    };
  }

  private bboxWhere(query: MapPlacesQueryDto): {
    latitude: { gte: number; lte: number };
    longitude: { gte: number; lte: number };
  } {
    const bounds = this.effectiveBounds(query);
    return {
      latitude: { gte: bounds.south, lte: bounds.north },
      longitude: { gte: bounds.west, lte: bounds.east },
    };
  }

  private effectiveBounds(query: MapPlacesQueryDto): {
    north: number;
    south: number;
    east: number;
    west: number;
  } {
    if (!hasNearbyCoordinates(query)) return query;
    const nearbyBounds = radiusBounds(
      query.lat,
      query.lng,
      nearbyRadiusKm(query),
    );
    return {
      north: Math.min(query.north, nearbyBounds.north),
      south: Math.max(query.south, nearbyBounds.south),
      east: Math.min(query.east, nearbyBounds.east),
      west: Math.max(query.west, nearbyBounds.west),
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

  private validateQuery(query: MapPlacesQueryDto): void {
    validatePublicDiscoveryScope(query);
    validateNearbyCoordinates(query);
    if (query.q) query.q = query.q.trim();
    if (query.south > query.north) {
      throw new BadRequestException('south cannot be greater than north.');
    }
    if (query.west > query.east) {
      throw new BadRequestException('west cannot be greater than east.');
    }
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
    this.resolveTypes(query);
  }

  private resolveTypes(query: MapPlacesQueryDto): SearchEntityType[] {
    const hasServiceFilter = Boolean(
      query.serviceCategory ||
      query.pricingModel ||
      query.currency ||
      query.minPrice !== undefined ||
      query.maxPrice !== undefined,
    );
    if (hasServiceFilter) {
      if (
        query.types &&
        (query.types.length !== 1 ||
          query.types[0] !== SearchEntityType.SERVICE)
      ) {
        throw new BadRequestException('Service filters require types=service.');
      }
      return [SearchEntityType.SERVICE];
    }
    if (query.businessCategory) {
      if (
        query.types &&
        query.types.some(
          (type) =>
            type !== SearchEntityType.BUSINESS &&
            type !== SearchEntityType.SERVICE,
        )
      ) {
        throw new BadRequestException(
          'businessCategory applies only to business and service results.',
        );
      }
      return (
        query.types ?? [SearchEntityType.BUSINESS, SearchEntityType.SERVICE]
      );
    }
    return query.types ?? Object.values(SearchEntityType);
  }

  private fairMerge(batches: MapMarker[][], limit: number): MapMarker[] {
    const merged: MapMarker[] = [];
    for (let index = 0; merged.length < limit; index += 1) {
      let added = false;
      for (const batch of batches) {
        const marker = batch[index];
        if (marker) {
          merged.push(marker);
          added = true;
          if (merged.length === limit) break;
        }
      }
      if (!added) break;
    }
    return merged;
  }

  private filterNearby(
    markers: MapMarker[],
    query: MapPlacesQueryDto,
  ): MapMarker[] {
    if (!hasNearbyCoordinates(query)) return markers;
    const radiusKm = nearbyRadiusKm(query);
    return markers.flatMap((marker) => {
      const distanceKm = haversineDistanceKm(
        query.lat,
        query.lng,
        marker.latitude,
        marker.longitude,
      );
      return distanceKm <= radiusKm ? [{ ...marker, distanceKm }] : [];
    });
  }

  private sortNearby(markers: MapMarker[]): MapMarker[] {
    return [...markers].sort(
      (left, right) =>
        (left.distanceKm ?? Number.POSITIVE_INFINITY) -
          (right.distanceKm ?? Number.POSITIVE_INFINITY) ||
        left.name.localeCompare(right.name) ||
        left.type.localeCompare(right.type) ||
        left.id.localeCompare(right.id),
    );
  }
  private async withRatings(markers: MapMarker[]): Promise<MapMarker[]> {
    const idsByType = new Map<SearchEntityType, string[]>();
    for (const marker of markers) {
      const ids = idsByType.get(marker.type) ?? [];
      ids.push(marker.id);
      idsByType.set(marker.type, ids);
    }
    const [
      businessRatings,
      serviceRatings,
      destinationRatings,
      attractionRatings,
    ] = await Promise.all([
      this.aggregateRatings(
        'businessId',
        idsByType.get(SearchEntityType.BUSINESS),
      ),
      this.aggregateRatings(
        'serviceId',
        idsByType.get(SearchEntityType.SERVICE),
      ),
      this.aggregateRatings(
        'destinationId',
        idsByType.get(SearchEntityType.DESTINATION),
      ),
      this.aggregateRatings(
        'attractionId',
        idsByType.get(SearchEntityType.ATTRACTION),
      ),
    ]);
    const ratings = new Map<string, { average: number; count: number }>([
      ...businessRatings,
      ...serviceRatings,
      ...destinationRatings,
      ...attractionRatings,
    ]);
    return markers.map((marker) => ({
      ...marker,
      rating: ratings.get(`${marker.type}:${marker.id}`),
    }));
  }

  private async aggregateRatings(
    field: 'businessId' | 'serviceId' | 'destinationId' | 'attractionId',
    ids: string[] | undefined,
  ): Promise<[string, { average: number; count: number }][]> {
    if (!ids?.length) return [];
    const groups = await this.prisma.review.groupBy({
      by: [field],
      where: { status: ReviewStatus.PUBLISHED, [field]: { in: ids } },
      _avg: { rating: true },
      _count: { rating: true },
    });
    return groups.flatMap((group) => {
      const id = group[field];
      if (!id || group._avg.rating === null) return [];
      const type = field.replace('Id', '').toUpperCase();
      return [
        [
          `${type.toLowerCase()}:${id}`,
          { average: group._avg.rating, count: group._count.rating },
        ],
      ];
    });
  }

  private mapDestination(record: DestinationRecord): MapMarker {
    return {
      type: SearchEntityType.DESTINATION,
      id: record.id,
      name: record.name,
      slug: record.slug,
      latitude: record.latitude,
      longitude: record.longitude,
      location: {
        city: { name: record.city.name, slug: record.city.slug },
        region: {
          name: record.city.region.name,
          slug: record.city.region.slug,
        },
      },
    };
  }

  private mapAttraction(record: AttractionRecord): MapMarker {
    return {
      type: SearchEntityType.ATTRACTION,
      id: record.id,
      name: record.name,
      slug: record.slug,
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
    };
  }

  private mapBusiness(record: BusinessRecord): MapMarker {
    return {
      type: SearchEntityType.BUSINESS,
      id: record.id,
      name: record.name,
      slug: record.slug,
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
    };
  }

  private mapService(record: ServiceRecord): MapMarker[] {
    const useBusiness =
      record.locationMode === ServiceLocationMode.BUSINESS_LOCATION;
    const latitude = useBusiness ? record.business.latitude : record.latitude;
    const longitude = useBusiness
      ? record.business.longitude
      : record.longitude;
    if (latitude === null || longitude === null) return [];
    return [
      {
        type: SearchEntityType.SERVICE,
        id: record.id,
        name: record.name,
        slug: record.slug,
        latitude,
        longitude,
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
      },
    ];
  }
}
