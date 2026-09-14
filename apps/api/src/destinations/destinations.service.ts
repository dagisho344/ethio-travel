import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { LocationStatus, Prisma, PublicationStatus } from '@prisma/client';
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from '../audit/audit.constants';
import { AuditContext, AuditService } from '../audit/audit.service';
import {
  paginate,
  PaginatedResponse,
  PaginationQueryDto,
} from '../common/dto/pagination.dto';
import { buildSlug } from '../common/utils/slug.util';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDestinationDto } from './dto/create-destination.dto';
import { DestinationQueryDto } from './dto/destination-query.dto';
import { UpdateDestinationDto } from './dto/update-destination.dto';

type DestinationRecord = Awaited<
  ReturnType<PrismaService['destination']['findFirstOrThrow']>
>;

@Injectable()
export class DestinationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit?: AuditService,
  ) {}

  async findPublic(
    query: PaginationQueryDto & { cityId?: string },
  ): Promise<PaginatedResponse<DestinationRecord>> {
    const where: Prisma.DestinationWhereInput = {
      cityId: query.cityId,
      status: PublicationStatus.PUBLISHED,
      city: {
        status: LocationStatus.ACTIVE,
        region: { status: LocationStatus.ACTIVE },
      },
      ...this.searchWhere(query.q),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.destination.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.destination.count({ where }),
    ]);
    return paginate(data, total, query.page, query.limit);
  }

  async findPublicByCitySlugs(
    regionSlug: string,
    citySlug: string,
    query: PaginationQueryDto,
  ): Promise<PaginatedResponse<DestinationRecord>> {
    const city = await this.prisma.city.findFirst({
      where: {
        slug: citySlug,
        status: LocationStatus.ACTIVE,
        region: { slug: regionSlug, status: LocationStatus.ACTIVE },
      },
    });
    if (!city) throw new NotFoundException('City not found.');
    return this.findPublic({ ...query, cityId: city.id });
  }

  async findPublicBySlugs(
    regionSlug: string,
    citySlug: string,
    destinationSlug: string,
  ): Promise<DestinationRecord> {
    const destination = await this.prisma.destination.findFirst({
      where: {
        slug: destinationSlug,
        status: PublicationStatus.PUBLISHED,
        city: {
          slug: citySlug,
          status: LocationStatus.ACTIVE,
          region: { slug: regionSlug, status: LocationStatus.ACTIVE },
        },
      },
    });
    if (!destination) throw new NotFoundException('Destination not found.');
    return destination;
  }

  async findAdmin(
    query: DestinationQueryDto,
  ): Promise<PaginatedResponse<DestinationRecord>> {
    const where: Prisma.DestinationWhereInput = {
      cityId: query.cityId,
      status: query.status,
      ...this.searchWhere(query.q),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.destination.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.destination.count({ where }),
    ]);
    return paginate(data, total, query.page, query.limit);
  }

  async findAdminById(id: string): Promise<DestinationRecord> {
    const destination = await this.prisma.destination.findUnique({
      where: { id },
    });
    if (!destination) throw new NotFoundException('Destination not found.');
    return destination;
  }

  async create(dto: CreateDestinationDto): Promise<DestinationRecord> {
    await this.ensureCityExists(dto.cityId);
    if (dto.status === PublicationStatus.PUBLISHED)
      await this.ensureCityPublishable(dto.cityId);
    const slug = dto.slug ?? buildSlug(dto.name);
    await this.ensureSlugAvailable(dto.cityId, slug);
    const now = new Date();
    try {
      return await this.prisma.destination.create({
        data: this.createData(dto, slug, now),
      });
    } catch (error) {
      this.throwConflictOnDuplicate(error);
      throw error;
    }
  }

  async update(
    id: string,
    dto: UpdateDestinationDto,
  ): Promise<DestinationRecord> {
    const existing = await this.findAdminById(id);
    if (
      existing.status === PublicationStatus.ARCHIVED &&
      dto.status &&
      dto.status !== PublicationStatus.ARCHIVED
    ) {
      throw new ConflictException('Archived destinations cannot be restored.');
    }
    const cityId = dto.cityId ?? existing.cityId;
    if (dto.cityId) await this.ensureCityExists(dto.cityId);
    if (dto.status === PublicationStatus.PUBLISHED)
      await this.ensureCityPublishable(cityId);
    const slug = dto.slug ?? (dto.name ? buildSlug(dto.name) : undefined);
    if (slug && (slug !== existing.slug || cityId !== existing.cityId))
      await this.ensureSlugAvailable(cityId, slug, id);
    const now = new Date();
    try {
      return await this.prisma.destination.update({
        where: { id },
        data: this.updateData(dto, slug, existing, now),
      });
    } catch (error) {
      this.throwConflictOnDuplicate(error);
      throw error;
    }
  }

  async createAdmin(
    actorUserId: string,
    dto: CreateDestinationDto,
    context: AuditContext,
  ): Promise<DestinationRecord> {
    await this.ensureCityExists(dto.cityId);
    const slug = dto.slug ?? buildSlug(dto.name);
    await this.ensureSlugAvailable(dto.cityId, slug);
    const draftDto = { ...dto, status: undefined };
    try {
      return await this.prisma.$transaction(async (tx) => {
        const destination = await tx.destination.create({
          data: this.createData(draftDto, slug, new Date()),
        });
        await this.audit?.record(tx, {
          ...context,
          action: AUDIT_ACTIONS.ADMIN_DESTINATION_CREATED,
          actorUserId,
          entityId: destination.id,
          entityType: AUDIT_ENTITY_TYPES.DESTINATION,
          metadata: {
            destinationId: destination.id,
            nextStatus: destination.status,
          },
        });
        return destination;
      });
    } catch (error) {
      this.throwConflictOnDuplicate(error);
      throw error;
    }
  }

  async updateAdmin(
    id: string,
    actorUserId: string,
    dto: UpdateDestinationDto,
    context: AuditContext,
  ): Promise<DestinationRecord> {
    const existing = await this.findAdminById(id);
    const cityId = dto.cityId ?? existing.cityId;
    if (dto.cityId) await this.ensureCityExists(dto.cityId);
    const slug = dto.slug ?? (dto.name ? buildSlug(dto.name) : undefined);
    if (slug && (slug !== existing.slug || cityId !== existing.cityId)) {
      await this.ensureSlugAvailable(cityId, slug, id);
    }
    const updateDto = { ...dto, status: undefined };
    try {
      return await this.prisma.$transaction(async (tx) => {
        const destination = await tx.destination.update({
          where: { id },
          data: this.updateData(updateDto, slug, existing, new Date()),
        });
        await this.audit?.record(tx, {
          ...context,
          action: AUDIT_ACTIONS.ADMIN_DESTINATION_UPDATED,
          actorUserId,
          entityId: id,
          entityType: AUDIT_ENTITY_TYPES.DESTINATION,
          metadata: { destinationId: id },
        });
        return destination;
      });
    } catch (error) {
      this.throwConflictOnDuplicate(error);
      throw error;
    }
  }

  async publish(
    id: string,
    actorUserId: string,
    context: AuditContext,
  ): Promise<DestinationRecord> {
    const existing = await this.findAdminById(id);
    if (existing.status === PublicationStatus.ARCHIVED) {
      throw new ConflictException('Archived destinations cannot be published.');
    }
    await this.ensureCityPublishable(existing.cityId);
    return this.transitionPublication(
      id,
      [PublicationStatus.DRAFT, PublicationStatus.INACTIVE],
      PublicationStatus.PUBLISHED,
      actorUserId,
      context,
      AUDIT_ACTIONS.ADMIN_DESTINATION_PUBLISHED,
    );
  }

  async unpublish(
    id: string,
    actorUserId: string,
    context: AuditContext,
  ): Promise<DestinationRecord> {
    return this.transitionPublication(
      id,
      [PublicationStatus.PUBLISHED],
      PublicationStatus.INACTIVE,
      actorUserId,
      context,
      AUDIT_ACTIONS.ADMIN_DESTINATION_UNPUBLISHED,
    );
  }

  private async transitionPublication(
    id: string,
    previousStatuses: PublicationStatus[],
    nextStatus: PublicationStatus,
    actorUserId: string,
    context: AuditContext,
    action:
      | typeof AUDIT_ACTIONS.ADMIN_DESTINATION_PUBLISHED
      | typeof AUDIT_ACTIONS.ADMIN_DESTINATION_UNPUBLISHED,
  ): Promise<DestinationRecord> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.destination.findUnique({
        where: { id },
        select: { id: true, status: true },
      });
      if (!existing) throw new NotFoundException('Destination not found.');
      const update = await tx.destination.updateMany({
        where: { id, status: { in: previousStatuses } },
        data: {
          status: nextStatus,
          publishedAt:
            nextStatus === PublicationStatus.PUBLISHED ? new Date() : undefined,
        },
      });
      if (update.count !== 1) {
        throw new ConflictException(
          'Destination is not in a valid state for this action.',
        );
      }
      await this.audit?.record(tx, {
        ...context,
        action,
        actorUserId,
        entityId: id,
        entityType: AUDIT_ENTITY_TYPES.DESTINATION,
        metadata: {
          destinationId: id,
          nextStatus,
          previousStatus: existing.status,
        },
      });
      return tx.destination.findUniqueOrThrow({ where: { id } });
    });
  }

  private createData(
    dto: CreateDestinationDto,
    slug: string,
    now: Date,
  ): Prisma.DestinationCreateInput {
    const status = dto.status ?? PublicationStatus.DRAFT;
    return {
      city: { connect: { id: dto.cityId } },
      fullDescription: dto.fullDescription,
      latitude: dto.latitude,
      longitude: dto.longitude,
      name: dto.name,
      shortDescription: dto.shortDescription,
      slug,
      status,
      publishedAt: status === PublicationStatus.PUBLISHED ? now : undefined,
      archivedAt: status === PublicationStatus.ARCHIVED ? now : undefined,
      travelInfo: dto.travelInfo
        ? (dto.travelInfo as Prisma.InputJsonObject)
        : undefined,
    };
  }

  private updateData(
    dto: UpdateDestinationDto,
    slug: string | undefined,
    existing: DestinationRecord,
    now: Date,
  ): Prisma.DestinationUpdateInput {
    const status = dto.status;
    return {
      city: dto.cityId ? { connect: { id: dto.cityId } } : undefined,
      fullDescription: dto.fullDescription,
      latitude: dto.latitude,
      longitude: dto.longitude,
      name: dto.name,
      shortDescription: dto.shortDescription,
      slug,
      status,
      publishedAt:
        status === PublicationStatus.PUBLISHED && !existing.publishedAt
          ? now
          : undefined,
      archivedAt:
        status === PublicationStatus.ARCHIVED && !existing.archivedAt
          ? now
          : undefined,
      travelInfo: dto.travelInfo
        ? (dto.travelInfo as Prisma.InputJsonObject)
        : undefined,
    };
  }

  private searchWhere(q?: string): Prisma.DestinationWhereInput {
    return q
      ? {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { shortDescription: { contains: q, mode: 'insensitive' } },
          ],
        }
      : {};
  }

  private async ensureCityExists(cityId: string): Promise<void> {
    const city = await this.prisma.city.findUnique({ where: { id: cityId } });
    if (!city) throw new NotFoundException('City not found.');
  }

  private async ensureCityPublishable(cityId: string): Promise<void> {
    const city = await this.prisma.city.findFirst({
      where: {
        id: cityId,
        status: LocationStatus.ACTIVE,
        region: { status: LocationStatus.ACTIVE },
      },
    });
    if (!city)
      throw new ConflictException(
        'Destination cannot be published unless its city and region are active.',
      );
  }

  private async ensureSlugAvailable(
    cityId: string,
    slug: string,
    ignoreId?: string,
  ): Promise<void> {
    const existing = await this.prisma.destination.findUnique({
      where: { cityId_slug: { cityId, slug } },
    });
    if (existing && existing.id !== ignoreId)
      throw new ConflictException(
        'Destination slug already exists within this city.',
      );
  }

  private throwConflictOnDuplicate(error: unknown): void {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(
        'Destination slug already exists within this city.',
      );
    }
  }
}
