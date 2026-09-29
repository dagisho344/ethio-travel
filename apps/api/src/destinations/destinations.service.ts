import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  EditorialLocale,
  LocationStatus,
  Prisma,
  PublicationStatus,
} from '@prisma/client';
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from '../audit/audit.constants';
import { AuditContext, AuditService } from '../audit/audit.service';
import { paginate, PaginatedResponse } from '../common/dto/pagination.dto';
import { buildSlug } from '../common/utils/slug.util';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDestinationDto } from './dto/create-destination.dto';
import { DestinationQueryDto } from './dto/destination-query.dto';
import { PublicDestinationQueryDto } from './dto/public-destination-query.dto';
import { UpdateDestinationDto } from './dto/update-destination.dto';
import { UpsertDestinationTranslationDto } from './dto/upsert-destination-translation.dto';
import {
  isDestinationTranslationComplete,
  nonEmptyEditorialText,
  publishedAmharicEditorial,
  resolvePublicDestinationEditorial,
} from './public-destination-editorial.util';

type DestinationRecord = Awaited<
  ReturnType<PrismaService['destination']['findFirstOrThrow']>
>;

const publicDestinationInclude = {
  translations: publishedAmharicEditorial,
} satisfies Prisma.DestinationInclude;

type PublicDestinationQueryRecord = Prisma.DestinationGetPayload<{
  include: typeof publicDestinationInclude;
}>;

type DestinationTranslationValues = Partial<
  Pick<
    Prisma.DestinationTranslationUncheckedCreateInput,
    | 'bestTimeToVisit'
    | 'displayName'
    | 'fullDescription'
    | 'gettingThere'
    | 'localTips'
    | 'safetyNotes'
    | 'shortDescription'
  >
>;

const translationFields = [
  'displayName',
  'shortDescription',
  'fullDescription',
  'bestTimeToVisit',
  'gettingThere',
  'localTips',
  'safetyNotes',
] as const;

@Injectable()
export class DestinationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit?: AuditService,
  ) {}

  async findPublic(
    query: PublicDestinationQueryDto & { cityId?: string },
  ): Promise<PaginatedResponse<DestinationRecord>> {
    const locale = query.locale ?? EditorialLocale.en;
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
        include: publicDestinationInclude,
        orderBy: { name: 'asc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.destination.count({ where }),
    ]);
    return paginate(
      data.map((destination) =>
        this.resolvePublicDestination(destination, locale),
      ),
      total,
      query.page,
      query.limit,
    );
  }

  async findPublicByCitySlugs(
    regionSlug: string,
    citySlug: string,
    query: PublicDestinationQueryDto,
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
    locale: EditorialLocale = EditorialLocale.en,
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
      include: publicDestinationInclude,
    });
    if (!destination) throw new NotFoundException('Destination not found.');
    return this.resolvePublicDestination(destination, locale);
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

  async findTranslation(id: string, locale: EditorialLocale) {
    this.assertManagedTranslationLocale(locale);
    await this.findAdminById(id);
    const translation = await this.prisma.destinationTranslation.findUnique({
      where: { destinationId_locale: { destinationId: id, locale } },
    });
    if (!translation) {
      throw new NotFoundException('Destination translation not found.');
    }
    return translation;
  }

  async saveTranslation(
    destinationId: string,
    locale: EditorialLocale,
    actorUserId: string,
    dto: UpsertDestinationTranslationDto,
    context: AuditContext,
  ) {
    this.assertManagedTranslationLocale(locale);
    await this.findAdminById(destinationId);
    const values = this.translationValues(dto);

    return this.prisma.$transaction(async (tx) => {
      const translation = await tx.destinationTranslation.upsert({
        where: { destinationId_locale: { destinationId, locale } },
        create: {
          destinationId,
          isPublished: false,
          locale,
          publishedAt: null,
          ...values,
        },
        update: {
          isPublished: false,
          publishedAt: null,
          ...values,
        },
      });
      await this.audit?.record(tx, {
        ...context,
        action: AUDIT_ACTIONS.ADMIN_DESTINATION_TRANSLATION_SAVED,
        actorUserId,
        entityId: destinationId,
        entityType: AUDIT_ENTITY_TYPES.DESTINATION,
        metadata: { destinationId, locale },
      });
      return translation;
    });
  }

  async publishTranslation(
    destinationId: string,
    locale: EditorialLocale,
    actorUserId: string,
    context: AuditContext,
  ) {
    this.assertManagedTranslationLocale(locale);
    await this.findAdminById(destinationId);
    return this.prisma.$transaction(async (tx) => {
      const translation = await tx.destinationTranslation.findUnique({
        where: { destinationId_locale: { destinationId, locale } },
      });
      if (!translation) {
        throw new NotFoundException('Destination translation not found.');
      }
      this.assertTranslationComplete(translation);
      const published = await tx.destinationTranslation.update({
        where: { destinationId_locale: { destinationId, locale } },
        data: { isPublished: true, publishedAt: new Date() },
      });
      await this.audit?.record(tx, {
        ...context,
        action: AUDIT_ACTIONS.ADMIN_DESTINATION_TRANSLATION_PUBLISHED,
        actorUserId,
        entityId: destinationId,
        entityType: AUDIT_ENTITY_TYPES.DESTINATION,
        metadata: { destinationId, locale },
      });
      return published;
    });
  }

  async unpublishTranslation(
    destinationId: string,
    locale: EditorialLocale,
    actorUserId: string,
    context: AuditContext,
  ) {
    this.assertManagedTranslationLocale(locale);
    await this.findAdminById(destinationId);
    return this.prisma.$transaction(async (tx) => {
      const translation = await tx.destinationTranslation.findUnique({
        where: { destinationId_locale: { destinationId, locale } },
      });
      if (!translation) {
        throw new NotFoundException('Destination translation not found.');
      }
      const unpublished = await tx.destinationTranslation.update({
        where: { destinationId_locale: { destinationId, locale } },
        data: { isPublished: false, publishedAt: null },
      });
      await this.audit?.record(tx, {
        ...context,
        action: AUDIT_ACTIONS.ADMIN_DESTINATION_TRANSLATION_UNPUBLISHED,
        actorUserId,
        entityId: destinationId,
        entityType: AUDIT_ENTITY_TYPES.DESTINATION,
        metadata: { destinationId, locale },
      });
      return unpublished;
    });
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

  private resolvePublicDestination(
    destination: PublicDestinationQueryRecord,
    locale: EditorialLocale,
  ): DestinationRecord {
    const { translations, ...source } = destination;
    return resolvePublicDestinationEditorial(source, locale, translations[0]);
  }

  private translationValues(
    dto: UpsertDestinationTranslationDto,
  ): DestinationTranslationValues {
    const values: DestinationTranslationValues = {};
    for (const field of translationFields) {
      const value = dto[field];
      if (value !== undefined)
        values[field] = this.normalizeOptionalText(value);
    }
    return values;
  }

  private assertManagedTranslationLocale(locale: EditorialLocale): void {
    if (locale !== EditorialLocale.am) {
      throw new BadRequestException(
        'English destination content is managed on the canonical destination.',
      );
    }
  }

  private assertTranslationComplete(translation: {
    fullDescription: string | null;
    shortDescription: string | null;
  }): void {
    if (!isDestinationTranslationComplete(translation)) {
      throw new BadRequestException(
        'Published destination translations require a short and full description.',
      );
    }
  }

  private normalizeOptionalText(value: string | null): string | null {
    return this.nonEmptyText(value);
  }

  private nonEmptyText(value: string | null | undefined): string | null {
    return nonEmptyEditorialText(value);
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
