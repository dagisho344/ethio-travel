import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import {
  BusinessMemberRole,
  BusinessMemberStatus,
  BusinessLocationStatus,
  BusinessStatus,
  BusinessVerificationSummary,
  LocationStatus,
  MediaRole,
  MediaStatus,
  MediaVisibility,
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
import { AuditContext, AuditService } from '../audit/audit.service';
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from '../audit/audit.constants';
import { AuthenticatedUser } from '../auth/authenticated-user';
import { AdminActionReasonDto } from '../admin/dto/admin.dto';
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
  media: {
    where: {
      media: { status: MediaStatus.READY, visibility: MediaVisibility.PUBLIC },
    },
    include: { media: true },
    orderBy: [{ role: 'asc' }, { sortOrder: 'asc' }],
  },
} satisfies Prisma.BusinessInclude;
type BusinessRecord = Prisma.BusinessGetPayload<{
  include: typeof publicInclude;
}>;
type MemberRole = BusinessMemberRole;
type CurrentBusinessMember = {
  role: BusinessMemberRole;
  status: BusinessMemberStatus;
};
type MyBusinessRecord = BusinessRecord & {
  currentMember: CurrentBusinessMember;
  setup?: { serviceCount: number; activeMediaCount: number };
};

@Injectable()
export class BusinessesService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly audit?: AuditService,
  ) {}

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
        await tx.businessLocation.create({
          data: {
            businessId: business.id,
            cityId: dto.cityId,
            destinationId: dto.destinationId ?? null,
            label: 'Primary location',
            addressLine1: dto.addressLine1,
            addressLine2: dto.addressLine2 ?? null,
            neighborhood: dto.neighborhood ?? null,
            postalCode: dto.postalCode ?? null,
            latitude: dto.latitude,
            longitude: dto.longitude,
            timezone: 'Africa/Addis_Ababa',
            isPrimary: true,
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
  ): Promise<PaginatedResponse<MyBusinessRecord>> {
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
    const memberships = data.length
      ? await this.prisma.businessMember.findMany({
          where: {
            businessId: { in: data.map((business) => business.id) },
            status: BusinessMemberStatus.ACTIVE,
            userId,
          },
          select: { businessId: true, role: true, status: true },
        })
      : [];
    const membersByBusinessId = new Map(
      memberships.map((member) => [
        member.businessId,
        { role: member.role, status: member.status },
      ]),
    );
    const businesses = data.map((business) => {
      const currentMember = membersByBusinessId.get(business.id);
      if (!currentMember)
        throw new ForbiddenException('Business membership is required.');
      return { ...business, currentMember };
    });
    return paginate(businesses, total, query.page, query.limit);
  }

  async findMineById(
    userId: string,
    businessId: string,
  ): Promise<MyBusinessRecord> {
    const member = await this.requireMembership(userId, businessId, [
      BusinessMemberRole.OWNER,
      BusinessMemberRole.MANAGER,
      BusinessMemberRole.STAFF,
    ]);
    const business = await this.findAdminById(businessId);
    const [serviceCount, activeMediaCount] = await this.prisma.$transaction([
      this.prisma.service.count({
        where: { businessId, status: { not: 'ARCHIVED' } },
      }),
      this.prisma.businessMedia.count({
        where: { businessId, media: { status: MediaStatus.READY } },
      }),
    ]);
    return {
      ...business,
      currentMember: { role: member.role, status: member.status },
      setup: { serviceCount, activeMediaCount },
    };
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
    const resolvedDestinationId =
      dto.destinationId !== undefined
        ? (dto.destinationId ?? undefined)
        : dto.cityId && dto.cityId !== existing.cityId
          ? undefined
          : (existing.destinationId ?? undefined);
    await this.validateLocationAndCategory(
      dto.cityId ?? existing.cityId,
      dto.categoryId ?? existing.categoryId,
      resolvedDestinationId,
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
      return await this.prisma.$transaction(async (tx) => {
        const business = await tx.business.update({
          where: { id: businessId },
          data: { ...dto, slug },
          include: publicInclude,
        });
        const primaryLocation = await tx.businessLocation.findFirst({
          where: {
            businessId,
            isPrimary: true,
            status: BusinessLocationStatus.ACTIVE,
          },
        });
        if (!primaryLocation) {
          throw new ConflictException('Business primary location is required.');
        }
        await tx.businessLocation.update({
          where: { id: primaryLocation.id },
          data: {
            cityId: business.cityId,
            destinationId: business.destinationId,
            addressLine1: business.addressLine1,
            addressLine2: business.addressLine2,
            neighborhood: business.neighborhood,
            postalCode: business.postalCode,
            latitude: business.latitude,
            longitude: business.longitude,
          },
        });
        return business;
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

  async findAdminDetail(id: string) {
    const business = await this.prisma.business.findUnique({
      where: { id },
      include: {
        category: true,
        city: { include: { region: true } },
        destination: true,
        members: {
          include: {
            user: {
              select: {
                email: true,
                id: true,
                profile: { select: { firstName: true, lastName: true } },
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        locations: {
          include: {
            city: { select: { name: true } },
            destination: { select: { name: true } },
            operatingHours: { orderBy: { dayOfWeek: 'asc' } },
          },
          orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
        },
        services: {
          select: { id: true, name: true, status: true },
          orderBy: { createdAt: 'desc' },
        },
        media: {
          select: { media: { select: { status: true, visibility: true } } },
        },
        verifications: {
          select: {
            createdAt: true,
            id: true,
            rejectionReason: true,
            reviewedAt: true,
            status: true,
            submittedAt: true,
            documents: { select: { status: true, type: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        _count: { select: { bookings: true, payments: true, reviews: true } },
      },
    });
    if (!business) throw new NotFoundException('Business not found.');
    const recentAdminActions = this.audit
      ? await this.audit.recentForEntity(AUDIT_ENTITY_TYPES.BUSINESS, id)
      : [];
    return {
      business: {
        category: business.category.name,
        city: business.city.name,
        createdAt: business.createdAt,
        description: business.description,
        destination: business.destination?.name ?? null,
        id: business.id,
        name: business.name,
        status: business.status,
        verificationSummary: business.verificationSummary,
      },
      counts: {
        bookings: business._count.bookings,
        payments: business._count.payments,
        reviews: business._count.reviews,
        services: business.services.length,
      },
      locations: business.locations.map((location) => ({
        addressLine1: location.addressLine1,
        city: location.city.name,
        destination: location.destination?.name ?? null,
        hours: location.operatingHours.map((hour) => ({
          closesAt: hour.closesAt,
          dayOfWeek: hour.dayOfWeek,
          isClosed: hour.isClosed,
          opensAt: hour.opensAt,
        })),
        id: location.id,
        isPrimary: location.isPrimary,
        label: location.label,
        status: location.status,
        timezone: location.timezone,
      })),
      media: {
        publicReadyCount: business.media.filter(
          (item) =>
            item.media.status === MediaStatus.READY &&
            item.media.visibility === MediaVisibility.PUBLIC,
        ).length,
        total: business.media.length,
      },
      members: business.members.map((member) => ({
        createdAt: member.createdAt,
        role: member.role,
        status: member.status,
        user: {
          email: member.user.email,
          firstName: member.user.profile?.firstName ?? null,
          id: member.user.id,
          lastName: member.user.profile?.lastName ?? null,
        },
      })),
      services: business.services,
      recentAdminActions,
      verifications: business.verifications.map((verification) => ({
        createdAt: verification.createdAt,
        documentCount: verification.documents.length,
        id: verification.id,
        rejectionReason: verification.rejectionReason,
        reviewedAt: verification.reviewedAt,
        status: verification.status,
        submittedAt: verification.submittedAt,
      })),
    };
  }
  async updateAdmin(
    id: string,
    dto: AdminUpdateBusinessDto,
  ): Promise<BusinessRecord> {
    if (dto.status !== undefined) {
      throw new BadRequestException(
        'Use the dedicated suspend or restore command to change business status.',
      );
    }
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
    const resolvedDestinationId =
      dto.destinationId !== undefined
        ? (dto.destinationId ?? undefined)
        : dto.cityId && dto.cityId !== existing.cityId
          ? undefined
          : (existing.destinationId ?? undefined);
    await this.validateLocationAndCategory(
      dto.cityId ?? existing.cityId,
      dto.categoryId ?? existing.categoryId,
      resolvedDestinationId,
    );
    const slug = dto.slug ?? (dto.name ? buildSlug(dto.name) : undefined);
    if (
      slug &&
      (slug !== existing.slug || (dto.cityId && dto.cityId !== existing.cityId))
    )
      await this.ensureSlugAvailable(dto.cityId ?? existing.cityId, slug, id);
    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      const business = await tx.business.update({
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
      const primaryLocation = await tx.businessLocation.findFirst({
        where: {
          businessId: id,
          isPrimary: true,
          status: BusinessLocationStatus.ACTIVE,
        },
      });
      if (primaryLocation) {
        await tx.businessLocation.update({
          where: { id: primaryLocation.id },
          data: {
            cityId: business.cityId,
            destinationId: business.destinationId,
            addressLine1: business.addressLine1,
            addressLine2: business.addressLine2,
            neighborhood: business.neighborhood,
            postalCode: business.postalCode,
            latitude: business.latitude,
            longitude: business.longitude,
          },
        });
      }
      return business;
    });
  }

  async suspendByAdmin(
    actor: AuthenticatedUser,
    businessId: string,
    dto: AdminActionReasonDto,
    context: AuditContext,
  ) {
    const reason = this.requiredAdminReason(dto.reason);
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.business.findUnique({
        where: { id: businessId },
        select: { id: true, status: true, verificationSummary: true },
      });
      if (!existing) throw new NotFoundException('Business not found.');
      if (
        existing.status !== BusinessStatus.ACTIVE &&
        existing.status !== BusinessStatus.DRAFT
      ) {
        throw new ConflictException(
          'Only active or draft businesses can be suspended.',
        );
      }
      const changed = await tx.business.updateMany({
        where: { id: businessId, status: existing.status },
        data: { status: BusinessStatus.SUSPENDED, suspendedAt: new Date() },
      });
      if (changed.count !== 1) {
        throw new ConflictException(
          'Business status changed. Refresh and try again.',
        );
      }
      await this.recordBusinessStatusAudit(
        tx,
        actor,
        businessId,
        reason,
        context,
        existing.status,
        BusinessStatus.SUSPENDED,
        AUDIT_ACTIONS.ADMIN_BUSINESS_SUSPENDED,
      );
      return {
        id: businessId,
        status: BusinessStatus.SUSPENDED,
        verificationSummary: existing.verificationSummary,
      };
    });
  }

  async restoreByAdmin(
    actor: AuthenticatedUser,
    businessId: string,
    dto: AdminActionReasonDto,
    context: AuditContext,
  ) {
    const reason = this.requiredAdminReason(dto.reason);
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.business.findUnique({
        where: { id: businessId },
        select: { id: true, status: true, verificationSummary: true },
      });
      if (!existing) throw new NotFoundException('Business not found.');
      if (existing.status !== BusinessStatus.SUSPENDED) {
        throw new ConflictException(
          'Only suspended businesses can be restored.',
        );
      }
      const nextStatus =
        existing.verificationSummary === BusinessVerificationSummary.VERIFIED
          ? BusinessStatus.ACTIVE
          : BusinessStatus.DRAFT;
      const changed = await tx.business.updateMany({
        where: { id: businessId, status: BusinessStatus.SUSPENDED },
        data: { status: nextStatus, suspendedAt: null },
      });
      if (changed.count !== 1) {
        throw new ConflictException(
          'Business status changed. Refresh and try again.',
        );
      }
      await this.recordBusinessStatusAudit(
        tx,
        actor,
        businessId,
        reason,
        context,
        existing.status,
        nextStatus,
        AUDIT_ACTIONS.ADMIN_BUSINESS_RESTORED,
      );
      return {
        id: businessId,
        status: nextStatus,
        verificationSummary: existing.verificationSummary,
      };
    });
  }

  private async recordBusinessStatusAudit(
    tx: Prisma.TransactionClient,
    actor: AuthenticatedUser,
    businessId: string,
    reason: string,
    context: AuditContext,
    previousStatus: BusinessStatus,
    nextStatus: BusinessStatus,
    action:
      | typeof AUDIT_ACTIONS.ADMIN_BUSINESS_SUSPENDED
      | typeof AUDIT_ACTIONS.ADMIN_BUSINESS_RESTORED,
  ): Promise<void> {
    if (!this.audit) return;
    const base = {
      ...context,
      actorUserId: actor.sub,
      entityId: businessId,
      entityType: AUDIT_ENTITY_TYPES.BUSINESS,
      metadata: { nextStatus, previousStatus },
      reason,
    } as const;
    await this.audit.record(tx, { ...base, action });
    await this.audit.record(tx, {
      ...base,
      action: AUDIT_ACTIONS.ADMIN_BUSINESS_STATUS_CHANGED,
    });
  }

  private requiredAdminReason(value: string): string {
    const reason = value.trim();
    if (reason.length < 3 || reason.length > 1000) {
      throw new BadRequestException(
        'A reason between 3 and 1000 characters is required.',
      );
    }
    return reason;
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
      media: {
        logo: this.publicMediaForRole(business, MediaRole.LOGO),
        hero: this.publicMediaForRole(business, MediaRole.HERO),
      },
    };
  }

  private publicMediaForRole(business: BusinessRecord, role: MediaRole) {
    const attachment = business.media.find((item) => item.role === role);
    if (!attachment) return null;
    return {
      id: attachment.media.id,
      originalFilename: attachment.media.originalFilename,
      mimeType: attachment.media.mimeType,
      mediaType: attachment.media.mediaType,
      width: attachment.media.width,
      height: attachment.media.height,
      altText: attachment.altText,
      caption: attachment.caption,
      accessPath: `/api/v1/media/public/${attachment.media.id}`,
    };
  }
}
