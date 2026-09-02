import { BadRequestException, Injectable } from '@nestjs/common';
import { PricingModel, Prisma } from '@prisma/client';
import { paginate, PaginatedResponse } from '../common/dto/pagination.dto';
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
  createdAt: Date;
  relevance: number;
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
    include: {
      category: true,
      city: { include: { region: true } },
      destination: true,
    },
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
    const types = normalized.types ?? Object.values(SearchEntityType);
    const take = normalized.page * normalized.limit;
    const [items, total] = await Promise.all([
      this.collectResults(normalized, types, take),
      this.countResults(normalized, types),
    ]);
    const sorted = this.sortResults(items, normalized.sort);
    const pageItems = sorted.slice(
      (normalized.page - 1) * normalized.limit,
      normalized.page * normalized.limit,
    );
    return paginate(
      pageItems.map((item) => this.toResponseItem(item)),
      total,
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
        include: destinationInclude,
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
        include: attractionInclude,
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
        include: businessInclude,
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
        include: serviceInclude,
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
      ...publicDestinationWhere(query),
      ...this.destinationText(query.q),
    };
  }

  private attractionWhere(query: SearchQueryDto): Prisma.AttractionWhereInput {
    return { ...publicAttractionWhere(query), ...this.attractionText(query.q) };
  }

  private businessWhere(query: SearchQueryDto): Prisma.BusinessWhereInput {
    return { ...publicBusinessWhere(query), ...this.businessText(query.q) };
  }

  private serviceWhere(query: SearchQueryDto): Prisma.ServiceWhereInput {
    return {
      ...publicServiceWhere(query),
      pricingModel: query.pricingModel,
      price:
        query.minPrice !== undefined || query.maxPrice !== undefined
          ? { gte: query.minPrice, lte: query.maxPrice }
          : undefined,
      ...this.serviceText(query.q),
    };
  }

  private destinationText(q?: string): Prisma.DestinationWhereInput {
    return q
      ? {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { shortDescription: { contains: q, mode: 'insensitive' } },
            { fullDescription: { contains: q, mode: 'insensitive' } },
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
          ],
        }
      : {};
  }

  private orderBy(
    sort: SearchSort,
  ): Prisma.DestinationOrderByWithRelationInput {
    if (sort === SearchSort.NAME_DESC) return { name: 'desc' };
    if (sort === SearchSort.NEWEST) return { createdAt: 'desc' };
    return { name: 'asc' };
  }

  private serviceOrderBy(
    sort: SearchSort,
  ): Prisma.ServiceOrderByWithRelationInput {
    if (sort === SearchSort.PRICE_ASC)
      return { price: { sort: 'asc', nulls: 'last' } };
    if (sort === SearchSort.PRICE_DESC)
      return { price: { sort: 'desc', nulls: 'last' } };
    if (sort === SearchSort.NAME_DESC) return { name: 'desc' };
    if (sort === SearchSort.NEWEST) return { createdAt: 'desc' };
    return { name: 'asc' };
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
      if (sort === SearchSort.PRICE_ASC)
        return (
          this.priceValue(left) - this.priceValue(right) ||
          this.nameCompare(left, right)
        );
      if (sort === SearchSort.PRICE_DESC)
        return (
          this.priceValue(right) - this.priceValue(left) ||
          this.nameCompare(left, right)
        );
      return right.relevance - left.relevance || this.nameCompare(left, right);
    });
  }

  private priceValue(item: SearchResult): number {
    if (
      item.type !== SearchEntityType.SERVICE ||
      item.price === null ||
      item.price === undefined
    )
      return Number.POSITIVE_INFINITY;
    return Number(item.price);
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

  private validateQuery(query: SearchQueryDto): void {
    if (query.q) query.q = query.q.trim();
    if (
      query.minPrice !== undefined &&
      query.maxPrice !== undefined &&
      query.minPrice > query.maxPrice
    )
      throw new BadRequestException('minPrice cannot exceed maxPrice.');
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
