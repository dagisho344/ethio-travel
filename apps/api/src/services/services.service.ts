import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BusinessMemberRole,
  BusinessStatus,
  BusinessVerificationSummary,
  LocationStatus,
  PricingModel,
  Prisma,
  PublicationStatus,
  ServiceLocationMode,
  ServiceStatus,
  UserStatus,
} from '@prisma/client';
import {
  paginate,
  PaginatedResponse,
  PaginationQueryDto,
} from '../common/dto/pagination.dto';
import { buildSlug } from '../common/utils/slug.util';
import { BusinessesService } from '../businesses/businesses.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateServiceDto,
  ServiceAttributesDto,
} from './dto/create-service.dto';
import { AdminServiceQueryDto, ServiceQueryDto } from './dto/service-query.dto';
import { UpdateServiceDto } from './dto/update-service.dto';

const serviceInclude = Prisma.validator<Prisma.ServiceInclude>()({
  category: true,
  business: {
    include: {
      category: true,
      city: { include: { region: true } },
      destination: true,
    },
  },
});

type ServiceRecord = Prisma.ServiceGetPayload<{
  include: typeof serviceInclude;
}>;
type ServiceRouteScope = {
  regionSlug?: string;
  citySlug?: string;
  businessSlug?: string;
  destinationSlug?: string;
};
type WritableRole = 'OWNER' | 'MANAGER';
const writableRoles: WritableRole[] = [
  BusinessMemberRole.OWNER,
  BusinessMemberRole.MANAGER,
];
const readableRoles = [...writableRoles, BusinessMemberRole.STAFF];
const paidModels = [
  PricingModel.FIXED,
  PricingModel.PER_PERSON,
  PricingModel.PER_NIGHT,
  PricingModel.PER_HOUR,
  PricingModel.PER_DAY,
  PricingModel.STARTING_FROM,
];
const allowedAttributeKeys = [
  'highlights',
  'included',
  'excluded',
  'requirements',
  'tags',
] as const;

type AttributeKey = (typeof allowedAttributeKeys)[number];

@Injectable()
export class ServicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly businesses: BusinessesService,
  ) {}

  async create(
    userId: string,
    businessId: string,
    dto: CreateServiceDto,
  ): Promise<ServiceRecord> {
    await this.ensureActiveUser(userId);
    await this.businesses.requireMembership(userId, businessId, writableRoles);
    await this.validateCategory(dto.categoryId);
    this.validateDto(dto);
    const slug = dto.slug ?? buildSlug(dto.name);
    await this.ensureSlugAvailable(businessId, slug);
    try {
      return await this.prisma.service.create({
        data: this.toCreateData(businessId, slug, dto),
        include: serviceInclude,
      });
    } catch (error) {
      this.throwSlugConflict(error);
      throw error;
    }
  }

  async findPublic(
    query: ServiceQueryDto,
    scope: ServiceRouteScope = {},
  ): Promise<PaginatedResponse<ReturnType<ServicesService['toPublic']>>> {
    const where = this.publicWhere(query, scope);
    const [records, total] = await this.prisma.$transaction([
      this.prisma.service.findMany({
        where,
        include: serviceInclude,
        orderBy: { name: 'asc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.service.count({ where }),
    ]);
    return paginate(
      records.map((record) => this.toPublic(record)),
      total,
      query.page,
      query.limit,
    );
  }

  async findPublicByBusinessSlugs(
    regionSlug: string,
    citySlug: string,
    businessSlug: string,
    query: PaginationQueryDto,
  ): Promise<PaginatedResponse<ReturnType<ServicesService['toPublic']>>> {
    return this.findPublic(query, { regionSlug, citySlug, businessSlug });
  }

  async findPublicBySlugs(
    regionSlug: string,
    citySlug: string,
    businessSlug: string,
    serviceSlug: string,
  ): Promise<ReturnType<ServicesService['toPublic']>> {
    const service = await this.prisma.service.findFirst({
      where: {
        ...this.publicWhere(
          { page: 1, limit: 1 },
          { regionSlug, citySlug, businessSlug },
        ),
        slug: serviceSlug,
      },
      include: serviceInclude,
    });
    if (!service) throw new NotFoundException('Service not found.');
    return this.toPublic(service);
  }

  async findMine(
    userId: string,
    businessId: string,
    query: PaginationQueryDto,
  ): Promise<PaginatedResponse<ServiceRecord>> {
    await this.ensureActiveUser(userId);
    await this.businesses.requireMembership(userId, businessId, readableRoles);
    const where: Prisma.ServiceWhereInput = {
      businessId,
      ...this.searchWhere(query.q),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.service.findMany({
        where,
        include: serviceInclude,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.service.count({ where }),
    ]);
    return paginate(data, total, query.page, query.limit);
  }

  async findMineById(
    userId: string,
    businessId: string,
    serviceId: string,
  ): Promise<ServiceRecord> {
    await this.ensureActiveUser(userId);
    await this.businesses.requireMembership(userId, businessId, readableRoles);
    return this.findBusinessService(serviceId, businessId);
  }

  async updateMine(
    userId: string,
    businessId: string,
    serviceId: string,
    dto: UpdateServiceDto,
  ): Promise<ServiceRecord> {
    await this.ensureActiveUser(userId);
    await this.businesses.requireMembership(userId, businessId, writableRoles);
    const existing = await this.findBusinessService(serviceId, businessId);
    if (existing.status === ServiceStatus.ARCHIVED)
      throw new ConflictException('Archived services cannot be changed.');
    await this.validateCategory(dto.categoryId ?? existing.categoryId);
    this.validateDto({
      categoryId: dto.categoryId ?? existing.categoryId,
      name: dto.name ?? existing.name,
      shortDescription: dto.shortDescription ?? existing.shortDescription,
      description: dto.description ?? existing.description,
      pricingModel: dto.pricingModel ?? existing.pricingModel,
      price:
        dto.price ??
        (existing.price === null ? undefined : Number(existing.price)),
      currency: dto.currency ?? existing.currency ?? undefined,
      durationMinutes:
        dto.durationMinutes ?? existing.durationMinutes ?? undefined,
      minGuests: dto.minGuests ?? existing.minGuests ?? undefined,
      maxGuests: dto.maxGuests ?? existing.maxGuests ?? undefined,
      locationMode: dto.locationMode ?? existing.locationMode,
      address: dto.address ?? existing.address ?? undefined,
      latitude:
        dto.latitude ??
        (existing.latitude === null ? undefined : Number(existing.latitude)),
      longitude:
        dto.longitude ??
        (existing.longitude === null ? undefined : Number(existing.longitude)),
      attributes:
        dto.attributes ?? this.toServiceAttributes(existing.attributes),
    });
    const slug = dto.slug ?? (dto.name ? buildSlug(dto.name) : undefined);
    if (slug && slug !== existing.slug)
      await this.ensureSlugAvailable(businessId, slug, serviceId);
    try {
      return await this.prisma.service.update({
        where: { id: serviceId },
        data: this.toUpdateData(dto, slug),
        include: serviceInclude,
      });
    } catch (error) {
      this.throwSlugConflict(error);
      throw error;
    }
  }

  async publishMine(
    userId: string,
    businessId: string,
    serviceId: string,
  ): Promise<ServiceRecord> {
    await this.ensureActiveUser(userId);
    await this.businesses.requireMembership(userId, businessId, writableRoles);
    return this.publish(serviceId, businessId);
  }

  async unpublishMine(
    userId: string,
    businessId: string,
    serviceId: string,
  ): Promise<ServiceRecord> {
    await this.ensureActiveUser(userId);
    await this.businesses.requireMembership(userId, businessId, writableRoles);
    return this.unpublish(serviceId, businessId);
  }

  async archiveMine(
    userId: string,
    businessId: string,
    serviceId: string,
  ): Promise<ServiceRecord> {
    await this.ensureActiveUser(userId);
    await this.businesses.requireMembership(userId, businessId, writableRoles);
    return this.archive(serviceId, businessId);
  }

  async findAdmin(
    query: AdminServiceQueryDto,
  ): Promise<PaginatedResponse<ServiceRecord>> {
    const where: Prisma.ServiceWhereInput = {
      businessId: query.businessId,
      status: query.status,
      ...this.filterWhere(query),
      ...this.searchWhere(query.q),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.service.findMany({
        where,
        include: serviceInclude,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.service.count({ where }),
    ]);
    return paginate(data, total, query.page, query.limit);
  }

  async findAdminById(id: string): Promise<ServiceRecord> {
    const service = await this.prisma.service.findUnique({
      where: { id },
      include: serviceInclude,
    });
    if (!service) throw new NotFoundException('Service not found.');
    return service;
  }

  async unpublishAdmin(id: string): Promise<ServiceRecord> {
    return this.unpublish(id);
  }

  async archiveAdmin(id: string): Promise<ServiceRecord> {
    return this.archive(id);
  }

  private async publish(
    serviceId: string,
    businessId?: string,
  ): Promise<ServiceRecord> {
    return this.prisma.$transaction(async (tx) => {
      const service = await tx.service.findFirst({
        where: { id: serviceId, businessId },
        include: serviceInclude,
      });
      if (!service) throw new NotFoundException('Service not found.');
      if (service.status === ServiceStatus.ARCHIVED)
        throw new ConflictException('Archived services are terminal.');
      if (!service.category.isActive)
        throw new ConflictException(
          'Inactive service category cannot be published.',
        );
      if (!this.isBusinessEligible(service))
        throw new ConflictException(
          'Service parent business is not publicly eligible.',
        );
      const result = await tx.service.updateMany({
        where: {
          id: serviceId,
          status: { in: [ServiceStatus.DRAFT, ServiceStatus.INACTIVE] },
        },
        data: {
          status: ServiceStatus.PUBLISHED,
          publishedAt: service.publishedAt ?? new Date(),
        },
      });
      if (result.count !== 1)
        throw new ConflictException(
          'Service cannot be published from its current state.',
        );
      return tx.service.findUniqueOrThrow({
        where: { id: serviceId },
        include: serviceInclude,
      });
    });
  }

  private async unpublish(
    serviceId: string,
    businessId?: string,
  ): Promise<ServiceRecord> {
    const existing = await this.findBusinessService(serviceId, businessId);
    if (existing.status === ServiceStatus.ARCHIVED)
      throw new ConflictException('Archived services are terminal.');
    const result = await this.prisma.service.updateMany({
      where: { id: serviceId, businessId, status: ServiceStatus.PUBLISHED },
      data: { status: ServiceStatus.INACTIVE },
    });
    if (result.count !== 1)
      throw new ConflictException(
        'Only published services can be unpublished.',
      );
    return this.findAdminById(serviceId);
  }

  private async archive(
    serviceId: string,
    businessId?: string,
  ): Promise<ServiceRecord> {
    const existing = await this.findBusinessService(serviceId, businessId);
    if (existing.status === ServiceStatus.ARCHIVED)
      throw new ConflictException('Archived services are terminal.');
    const result = await this.prisma.service.updateMany({
      where: {
        id: serviceId,
        businessId,
        status: { not: ServiceStatus.ARCHIVED },
      },
      data: {
        status: ServiceStatus.ARCHIVED,
        archivedAt: existing.archivedAt ?? new Date(),
      },
    });
    if (result.count !== 1)
      throw new ConflictException('Service could not be archived.');
    return this.findAdminById(serviceId);
  }

  private publicWhere(
    query: ServiceQueryDto,
    scope: ServiceRouteScope = {},
  ): Prisma.ServiceWhereInput {
    return {
      status: ServiceStatus.PUBLISHED,
      category: { isActive: true, code: query.category },
      business: {
        slug: scope.businessSlug,
        status: BusinessStatus.ACTIVE,
        verificationSummary: BusinessVerificationSummary.VERIFIED,
        category: { isActive: true, code: query.businessCategory },
        city: {
          slug: scope.citySlug ?? query.citySlug,
          status: LocationStatus.ACTIVE,
          region: {
            slug: scope.regionSlug ?? query.regionSlug,
            status: LocationStatus.ACTIVE,
          },
        },
        destination:
          (scope.destinationSlug ?? query.destinationSlug)
            ? {
                slug: scope.destinationSlug ?? query.destinationSlug,
                status: PublicationStatus.PUBLISHED,
              }
            : undefined,
        OR: [
          { destinationId: null },
          { destination: { status: PublicationStatus.PUBLISHED } },
        ],
      },
      ...this.filterWhere(query),
      ...this.searchWhere(query.q),
    };
  }

  private filterWhere(query: ServiceQueryDto): Prisma.ServiceWhereInput {
    return {
      pricingModel: query.pricingModel,
      price:
        query.minPrice !== undefined || query.maxPrice !== undefined
          ? { gte: query.minPrice, lte: query.maxPrice }
          : undefined,
    };
  }

  private searchWhere(q?: string): Prisma.ServiceWhereInput {
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

  private async findBusinessService(
    serviceId: string,
    businessId?: string,
  ): Promise<ServiceRecord> {
    const service = await this.prisma.service.findFirst({
      where: { id: serviceId, businessId },
      include: serviceInclude,
    });
    if (!service) throw new NotFoundException('Service not found.');
    return service;
  }

  private async validateCategory(categoryId: string): Promise<void> {
    const category = await this.prisma.serviceCategory.findFirst({
      where: { id: categoryId, isActive: true },
    });
    if (!category) throw new NotFoundException('Service category not found.');
  }

  private validateDto(dto: CreateServiceDto): void {
    if (dto.name.trim().length < 2)
      throw new BadRequestException(
        'Service name must be at least 2 characters.',
      );
    this.validatePricing(dto.pricingModel, dto.price, dto.currency);
    this.validateLocation(
      dto.locationMode ?? ServiceLocationMode.BUSINESS_LOCATION,
      dto.address,
      dto.latitude,
      dto.longitude,
    );
    if (
      dto.minGuests !== undefined &&
      dto.maxGuests !== undefined &&
      dto.minGuests > dto.maxGuests
    )
      throw new BadRequestException('minGuests cannot exceed maxGuests.');
    this.validateAttributes(dto.attributes);
  }

  private validatePricing(
    model: PricingModel,
    price?: number,
    currency?: string,
  ): void {
    if (price !== undefined && price < 0)
      throw new BadRequestException('Service price cannot be negative.');
    if (model === PricingModel.FREE) {
      if (currency)
        throw new BadRequestException('FREE services cannot include currency.');
      if (price !== undefined && price !== 0)
        throw new BadRequestException('FREE service price must be null or 0.');
      return;
    }
    if (model === PricingModel.CONTACT_FOR_PRICE) {
      if (price !== undefined)
        throw new BadRequestException(
          'CONTACT_FOR_PRICE services cannot include price.',
        );
      if (currency)
        throw new BadRequestException(
          'CONTACT_FOR_PRICE services cannot include currency.',
        );
      return;
    }
    if (paidModels.includes(model) && price === undefined)
      throw new BadRequestException('Paid services require price.');
    if (paidModels.includes(model) && !currency)
      throw new BadRequestException('Paid services require currency.');
    if (currency && !/^[A-Z]{3}$/.test(currency))
      throw new BadRequestException(
        'Currency must be uppercase ISO-style 3 characters.',
      );
  }

  private validateLocation(
    mode: ServiceLocationMode,
    address?: string,
    latitude?: number,
    longitude?: number,
  ): void {
    if (
      mode === ServiceLocationMode.BUSINESS_LOCATION &&
      (address || latitude !== undefined || longitude !== undefined)
    )
      throw new BadRequestException(
        'BUSINESS_LOCATION services cannot include custom address or coordinates.',
      );
    if (
      mode === ServiceLocationMode.CUSTOM_LOCATION &&
      (!address || latitude === undefined || longitude === undefined)
    )
      throw new BadRequestException(
        'CUSTOM_LOCATION services require address, latitude, and longitude.',
      );
    if (
      mode === ServiceLocationMode.MOBILE_VARIABLE &&
      (latitude === undefined) !== (longitude === undefined)
    )
      throw new BadRequestException(
        'Latitude and longitude must be supplied together.',
      );
  }

  private validateAttributes(attributes?: ServiceAttributesDto): void {
    if (!attributes) return;
    const keys = Object.keys(attributes);
    const unknown = keys.find(
      (key) => !allowedAttributeKeys.includes(key as AttributeKey),
    );
    if (unknown)
      throw new BadRequestException(
        `Unknown service attributes key: ${unknown}.`,
      );
    for (const key of keys) {
      const value = attributes[key as AttributeKey];
      if (!Array.isArray(value))
        throw new BadRequestException(
          'Service attribute values must be arrays.',
        );
      if (value.length > 30)
        throw new BadRequestException(
          'Service attribute arrays can contain at most 30 items.',
        );
    }
  }

  private async ensureActiveUser(userId: string): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, status: UserStatus.ACTIVE },
    });
    if (!user) throw new ForbiddenException('Active user is required.');
  }

  private async ensureSlugAvailable(
    businessId: string,
    slug: string,
    ignoreId?: string,
  ): Promise<void> {
    const existing = await this.prisma.service.findUnique({
      where: { businessId_slug: { businessId, slug } },
    });
    if (existing && existing.id !== ignoreId)
      throw new ConflictException(
        'Service slug already exists for this business.',
      );
  }

  private throwSlugConflict(error: unknown): void {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    )
      throw new ConflictException(
        'Service slug already exists for this business.',
      );
  }

  private toCreateData(
    businessId: string,
    slug: string,
    dto: CreateServiceDto,
  ): Prisma.ServiceCreateInput {
    return {
      business: { connect: { id: businessId } },
      category: { connect: { id: dto.categoryId } },
      name: dto.name,
      slug,
      shortDescription: dto.shortDescription,
      description: dto.description,
      price: dto.price,
      currency: dto.currency,
      pricingModel: dto.pricingModel,
      durationMinutes: dto.durationMinutes,
      minGuests: dto.minGuests,
      maxGuests: dto.maxGuests,
      locationMode: dto.locationMode,
      address: dto.address,
      latitude: dto.latitude,
      longitude: dto.longitude,
      attributes: this.toPrismaAttributes(dto.attributes),
      status: ServiceStatus.DRAFT,
    };
  }

  private toUpdateData(
    dto: UpdateServiceDto,
    slug?: string,
  ): Prisma.ServiceUpdateInput {
    const data: Prisma.ServiceUpdateInput = {};
    if (dto.categoryId !== undefined)
      data.category = { connect: { id: dto.categoryId } };
    if (slug !== undefined) data.slug = slug;
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.shortDescription !== undefined)
      data.shortDescription = dto.shortDescription;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.price !== undefined) data.price = dto.price;
    if (dto.currency !== undefined) data.currency = dto.currency;
    if (dto.pricingModel !== undefined) data.pricingModel = dto.pricingModel;
    if (dto.durationMinutes !== undefined)
      data.durationMinutes = dto.durationMinutes;
    if (dto.minGuests !== undefined) data.minGuests = dto.minGuests;
    if (dto.maxGuests !== undefined) data.maxGuests = dto.maxGuests;
    if (dto.locationMode !== undefined) data.locationMode = dto.locationMode;
    if (dto.address !== undefined) data.address = dto.address;
    if (dto.latitude !== undefined) data.latitude = dto.latitude;
    if (dto.longitude !== undefined) data.longitude = dto.longitude;
    if (dto.attributes !== undefined)
      data.attributes = this.toPrismaAttributes(dto.attributes);
    return data;
  }

  private toPrismaAttributes(
    attributes?: ServiceAttributesDto,
  ): Prisma.InputJsonObject | undefined {
    if (!attributes) return undefined;
    const output: Record<string, Prisma.InputJsonValue> = {};
    for (const key of allowedAttributeKeys) {
      const value = attributes[key];
      if (value !== undefined) output[key] = [...value];
    }
    return output;
  }

  private toServiceAttributes(
    value: Prisma.JsonValue,
  ): ServiceAttributesDto | undefined {
    if (value === null || typeof value !== 'object' || Array.isArray(value))
      return undefined;
    const attributes: ServiceAttributesDto = {};
    for (const key of allowedAttributeKeys) {
      const candidate = value[key];
      if (
        Array.isArray(candidate) &&
        candidate.every((item) => typeof item === 'string')
      ) {
        attributes[key] = candidate;
      }
    }
    return attributes;
  }

  private isBusinessEligible(service: ServiceRecord): boolean {
    return (
      service.business.status === BusinessStatus.ACTIVE &&
      service.business.verificationSummary ===
        BusinessVerificationSummary.VERIFIED &&
      service.business.category.isActive &&
      service.business.city.status === LocationStatus.ACTIVE &&
      service.business.city.region.status === LocationStatus.ACTIVE &&
      (!service.business.destination ||
        service.business.destination.status === PublicationStatus.PUBLISHED)
    );
  }

  private toPublic(service: ServiceRecord) {
    return {
      id: service.id,
      name: service.name,
      slug: service.slug,
      shortDescription: service.shortDescription,
      description: service.description,
      pricingModel: service.pricingModel,
      price: service.price,
      currency: service.currency,
      durationMinutes: service.durationMinutes,
      minGuests: service.minGuests,
      maxGuests: service.maxGuests,
      locationMode: service.locationMode,
      address: service.address,
      latitude: service.latitude,
      longitude: service.longitude,
      attributes: service.attributes,
      category: { code: service.category.code, name: service.category.name },
      business: {
        name: service.business.name,
        slug: service.business.slug,
        category: {
          code: service.business.category.code,
          name: service.business.category.name,
        },
      },
      city: {
        name: service.business.city.name,
        slug: service.business.city.slug,
      },
      region: {
        name: service.business.city.region.name,
        slug: service.business.city.region.slug,
      },
      destination: service.business.destination
        ? {
            name: service.business.destination.name,
            slug: service.business.destination.slug,
          }
        : null,
    };
  }
}
