import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, ServiceLocationMode } from '@prisma/client';
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
}

const destinationInclude = {
  city: { include: { region: true } },
} satisfies Prisma.DestinationInclude;
const attractionInclude = {
  destination: { include: { city: { include: { region: true } } } },
} satisfies Prisma.AttractionInclude;
const businessInclude = {
  category: true,
  city: { include: { region: true } },
  destination: true,
} satisfies Prisma.BusinessInclude;
const serviceInclude = {
  category: true,
  business: {
    include: { city: { include: { region: true } }, destination: true },
  },
} satisfies Prisma.ServiceInclude;

type DestinationRecord = Prisma.DestinationGetPayload<{
  include: typeof destinationInclude;
}>;
type AttractionRecord = Prisma.AttractionGetPayload<{
  include: typeof attractionInclude;
}>;
type BusinessRecord = Prisma.BusinessGetPayload<{
  include: typeof businessInclude;
}>;
type ServiceRecord = Prisma.ServiceGetPayload<{
  include: typeof serviceInclude;
}>;

@Injectable()
export class MapsService {
  constructor(private readonly prisma: PrismaService) {}

  async findPlaces(query: MapPlacesQueryDto): Promise<{ data: MapMarker[] }> {
    this.validateBounds(query);
    const types = query.types ?? Object.values(SearchEntityType);
    const take = query.limit;
    const batches = await Promise.all([
      types.includes(SearchEntityType.DESTINATION)
        ? this.destinations(query, take)
        : Promise.resolve([]),
      types.includes(SearchEntityType.ATTRACTION)
        ? this.attractions(query, take)
        : Promise.resolve([]),
      types.includes(SearchEntityType.BUSINESS)
        ? this.businesses(query, take)
        : Promise.resolve([]),
      types.includes(SearchEntityType.SERVICE)
        ? this.services(query, take)
        : Promise.resolve([]),
    ]);
    return { data: batches.flat().slice(0, query.limit) };
  }

  private destinations(
    query: MapPlacesQueryDto,
    take: number,
  ): Promise<MapMarker[]> {
    return this.prisma.destination
      .findMany({
        where: { ...publicDestinationWhere(query), ...this.bboxWhere(query) },
        include: destinationInclude,
        orderBy: { name: 'asc' },
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
        where: { ...publicAttractionWhere(query), ...this.bboxWhere(query) },
        include: attractionInclude,
        orderBy: { name: 'asc' },
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
        where: { ...publicBusinessWhere(query), ...this.bboxWhere(query) },
        include: businessInclude,
        orderBy: { name: 'asc' },
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
        include: serviceInclude,
        orderBy: { name: 'asc' },
        take,
      })
      .then((records) => records.flatMap((record) => this.mapService(record)));
  }

  private serviceWhere(query: MapPlacesQueryDto): Prisma.ServiceWhereInput {
    const businessWhere = publicBusinessWhere(query);
    return {
      status: publicServiceWhere(query).status,
      category: { isActive: true, code: query.serviceCategory },
      business: { is: businessWhere },
      OR: [
        {
          locationMode: ServiceLocationMode.BUSINESS_LOCATION,
          business: { is: { ...businessWhere, ...this.bboxWhere(query) } },
        },
        {
          locationMode: ServiceLocationMode.CUSTOM_LOCATION,
          ...this.bboxWhere(query),
        },
        {
          locationMode: ServiceLocationMode.MOBILE_VARIABLE,
          latitude: { gte: query.south, lte: query.north },
          longitude: { gte: query.west, lte: query.east },
        },
      ],
    };
  }

  private bboxWhere(query: MapPlacesQueryDto): {
    latitude: { gte: number; lte: number };
    longitude: { gte: number; lte: number };
  } {
    return {
      latitude: { gte: query.south, lte: query.north },
      longitude: { gte: query.west, lte: query.east },
    };
  }

  private validateBounds(query: MapPlacesQueryDto): void {
    if (query.south > query.north)
      throw new BadRequestException('south cannot be greater than north.');
    if (query.west > query.east)
      throw new BadRequestException('west cannot be greater than east.');
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
    if (
      record.locationMode === ServiceLocationMode.MOBILE_VARIABLE &&
      (!record.latitude || !record.longitude)
    )
      return [];
    const useBusiness =
      record.locationMode === ServiceLocationMode.BUSINESS_LOCATION;
    const latitude = useBusiness ? record.business.latitude : record.latitude;
    const longitude = useBusiness
      ? record.business.longitude
      : record.longitude;
    if (!latitude || !longitude) return [];
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
