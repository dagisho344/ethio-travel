import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BusinessMemberRole,
  BusinessMemberStatus,
  BusinessStatus,
  BusinessVerificationSummary,
  LocationStatus,
  Prisma,
  PublicationStatus,
  UserStatus,
} from '@prisma/client';
import {
  paginate,
  PaginatedResponse,
  PaginationQueryDto,
} from '../common/dto/pagination.dto';
import { buildSlug } from '../common/utils/slug.util';
import { PrismaService } from '../prisma/prisma.service';
import {
  AdminBusinessQueryDto,
  BusinessQueryDto,
} from './dto/business-query.dto';
import { CreateBusinessDto } from './dto/create-business.dto';
import { AdminUpdateBusinessDto } from './dto/admin-update-business.dto';
import { OwnerUpdateBusinessDto } from './dto/update-business.dto';

const publicInclude = {
  category: true,
  city: { include: { region: true } },
  destination: true,
} satisfies Prisma.BusinessInclude;
type BusinessRecord = Prisma.BusinessGetPayload<{
  include: typeof publicInclude;
}>;
type MemberRole = BusinessMemberRole;

@Injectable()
export class BusinessesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    userId: string,
    dto: CreateBusinessDto,
  ): Promise<BusinessRecord> {
    await this.ensureActiveUser(userId);
    await this.validateLocationAndCategory(
      dto.cityId,
      dto.categoryId,
      dto.destinationId,
    );
    const slug = dto.slug ?? buildSlug(dto.name);
    await this.ensureSlugAvailable(dto.cityId, slug);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const business = await tx.business.create({
          data: {
            ...dto,
            slug,
            status: BusinessStatus.DRAFT,
            verificationSummary: BusinessVerificationSummary.NOT_SUBMITTED,
          },
          include: publicInclude,
        });
        await tx.businessMember.create({
          data: {
            businessId: business.id,
            userId,
            role: BusinessMemberRole.OWNER,
            status: BusinessMemberStatus.ACTIVE,
          },
        });
        return business;
      });
    } catch (error) {
      this.throwSlugConflict(error);
      throw error;
    }
  }

  async findPublic(
    query: BusinessQueryDto & {
      regionSlug?: string;
      citySlug?: string;
      destinationSlug?: string;
    },
  ): Promise<PaginatedResponse<ReturnType<BusinessesService['toPublic']>>> {
    const where = this.publicWhere(query);
    const [records, total] = await this.prisma.$transaction([
      this.prisma.business.findMany({
        where,
        include: publicInclude,
        orderBy: { name: 'asc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.business.count({ where }),
    ]);
    return paginate(
      records.map((record) => this.toPublic(record)),
      total,
      query.page,
      query.limit,
    );
  }

  async findPublicBySlugs(
    regionSlug: string,
    citySlug: string,
    businessSlug: string,
  ): Promise<ReturnType<BusinessesService['toPublic']>> {
    const business = await this.prisma.business.findFirst({
      where: {
        ...this.publicWhere({ page: 1, limit: 1, regionSlug, citySlug }),
        slug: businessSlug,
      },
      include: publicInclude,
    });
    if (!business) throw new NotFoundException('Business not found.');
    return this.toPublic(business);
  }

  async findMine(
    userId: string,
    query: PaginationQueryDto,
  ): Promise<PaginatedResponse<BusinessRecord>> {
    const where: Prisma.BusinessWhereInput = {
      members: { some: { userId, status: BusinessMemberStatus.ACTIVE } },
      ...this.searchWhere(query.q),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.business.findMany({
        where,
        include: publicInclude,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.business.count({ where }),
    ]);
    return paginate(data, total, query.page, query.limit);
  }

  async findMineById(
    userId: string,
    businessId: string,
  ): Promise<BusinessRecord> {
    await this.requireMembership(userId, businessId, [
      BusinessMemberRole.OWNER,
      BusinessMemberRole.MANAGER,
      BusinessMemberRole.STAFF,
    ]);
    return this.findAdminById(businessId);
  }

  async updateMine(
    userId: string,
    businessId: string,
    dto: OwnerUpdateBusinessDto,
  ): Promise<BusinessRecord> {
    await this.requireMembership(userId, businessId, [
      BusinessMemberRole.OWNER,
      BusinessMemberRole.MANAGER,
    ]);
    const existing = await this.findAdminById(businessId);
    await this.validateLocationAndCategory(
      dto.cityId ?? existing.cityId,
      dto.categoryId ?? existing.categoryId,
      dto.destinationId ?? existing.destinationId ?? undefined,
    );
    const slug = dto.slug ?? (dto.name ? buildSlug(dto.name) : undefined);
    if (
      slug &&
      (slug !== existing.slug || (dto.cityId && dto.cityId !== existing.cityId))
    )
      await this.ensureSlugAvailable(
        dto.cityId ?? existing.cityId,
        slug,
        businessId,
      );
    try {
      return await this.prisma.business.update({
        where: { id: businessId },
        data: { ...dto, slug },
        include: publicInclude,
      });
    } catch (error) {
      this.throwSlugConflict(error);
      throw error;
    }
  }

  async findAdmin(
    query: AdminBusinessQueryDto,
  ): Promise<PaginatedResponse<BusinessRecord>> {
    const where: Prisma.BusinessWhereInput = {
      cityId: query.cityId,
      categoryId: query.categoryId,
      status: query.status,
      verificationSummary: query.verificationSummary,
      ...this.searchWhere(query.q),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.business.findMany({
        where,
        include: publicInclude,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.business.count({ where }),
    ]);
    return paginate(data, total, query.page, query.limit);
  }

  async findAdminById(id: string): Promise<BusinessRecord> {
    const business = await this.prisma.business.findUnique({
      where: { id },
      include: publicInclude,
    });
    if (!business) throw new NotFoundException('Business not found.');
    return business;
  }

  async updateAdmin(
    id: string,
    dto: AdminUpdateBusinessDto,
  ): Promise<BusinessRecord> {
    const existing = await this.findAdminById(id);
    if (
      existing.status === BusinessStatus.ARCHIVED &&
      dto.status &&
      dto.status !== BusinessStatus.ARCHIVED
    )
      throw new ConflictException('Archived businesses cannot be restored.');
    if (
      dto.status === BusinessStatus.ACTIVE &&
      existing.status === BusinessStatus.SUSPENDED &&
      existing.verificationSummary !== BusinessVerificationSummary.VERIFIED
    )
      throw new ConflictException(
        'Suspended business can only be restored when verified.',
      );
    if (
      dto.status === BusinessStatus.ACTIVE &&
      existing.status !== BusinessStatus.SUSPENDED
    )
      throw new ConflictException(
        'ACTIVE status is controlled by verification approval.',
      );
    await this.validateLocationAndCategory(
      dto.cityId ?? existing.cityId,
      dto.categoryId ?? existing.categoryId,
      dto.destinationId ?? existing.destinationId ?? undefined,
    );
    const slug = dto.slug ?? (dto.name ? buildSlug(dto.name) : undefined);
    if (
      slug &&
      (slug !== existing.slug || (dto.cityId && dto.cityId !== existing.cityId))
    )
      await this.ensureSlugAvailable(dto.cityId ?? existing.cityId, slug, id);
    const now = new Date();
    return this.prisma.business.update({
      where: { id },
      data: {
        ...dto,
        slug,
        suspendedAt:
          dto.status === BusinessStatus.SUSPENDED && !existing.suspendedAt
            ? now
            : undefined,
        archivedAt:
          dto.status === BusinessStatus.ARCHIVED && !existing.archivedAt
            ? now
            : undefined,
      },
      include: publicInclude,
    });
  }

  async requireMembership(
    userId: string,
    businessId: string,
    roles: MemberRole[],
  ) {
    const member = await this.prisma.businessMember.findFirst({
      where: {
        businessId,
        userId,
        status: BusinessMemberStatus.ACTIVE,
        role: { in: roles },
      },
    });
    if (!member)
      throw new ForbiddenException('Business membership is required.');
    return member;
  }

  private publicWhere(query: BusinessQueryDto): Prisma.BusinessWhereInput {
    return {
      status: BusinessStatus.ACTIVE,
      verificationSummary: BusinessVerificationSummary.VERIFIED,
      category: { isActive: true, code: query.category },
      city: {
        slug: query.citySlug,
        status: LocationStatus.ACTIVE,
        region: { slug: query.regionSlug, status: LocationStatus.ACTIVE },
      },
      destination: query.destinationSlug
        ? { slug: query.destinationSlug, status: PublicationStatus.PUBLISHED }
        : undefined,
      ...this.searchWhere(query.q),
    };
  }

  private searchWhere(q?: string): Prisma.BusinessWhereInput {
    return q
      ? {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
          ],
        }
      : {};
  }
  private async ensureActiveUser(userId: string): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, status: UserStatus.ACTIVE },
    });
    if (!user) throw new ForbiddenException('Active user is required.');
  }
  private async validateLocationAndCategory(
    cityId: string,
    categoryId: string,
    destinationId?: string,
  ): Promise<void> {
    const [city, category] = await Promise.all([
      this.prisma.city.findUnique({ where: { id: cityId } }),
      this.prisma.businessCategory.findFirst({
        where: { id: categoryId, isActive: true },
      }),
    ]);
    if (!city) throw new NotFoundException('City not found.');
    if (!category) throw new NotFoundException('Business category not found.');
    if (destinationId) {
      const destination = await this.prisma.destination.findFirst({
        where: { id: destinationId, cityId },
      });
      if (!destination)
        throw new BadRequestException(
          'Destination must belong to the selected city.',
        );
    }
  }
  private async ensureSlugAvailable(
    cityId: string,
    slug: string,
    ignoreId?: string,
  ): Promise<void> {
    const existing = await this.prisma.business.findUnique({
      where: { cityId_slug: { cityId, slug } },
    });
    if (existing && existing.id !== ignoreId)
      throw new ConflictException(
        'Business slug already exists within this city.',
      );
  }
  private throwSlugConflict(error: unknown): void {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    )
      throw new ConflictException(
        'Business slug already exists within this city.',
      );
  }
  private toPublic(business: BusinessRecord) {
    return {
      id: business.id,
      name: business.name,
      slug: business.slug,
      description: business.description,
      phone: business.phone,
      email: business.email,
      website: business.website,
      addressLine1: business.addressLine1,
      addressLine2: business.addressLine2,
      neighborhood: business.neighborhood,
      postalCode: business.postalCode,
      latitude: business.latitude,
      longitude: business.longitude,
      category: { code: business.category.code, name: business.category.name },
      city: { name: business.city.name, slug: business.city.slug },
      region: {
        name: business.city.region.name,
        slug: business.city.region.slug,
      },
      destination: business.destination
        ? { name: business.destination.name, slug: business.destination.slug }
        : null,
    };
  }
}
