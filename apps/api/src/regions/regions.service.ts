import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EditorialLocale, LocationStatus, Prisma } from '@prisma/client';
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from '../audit/audit.constants';
import { AuditContext, AuditService } from '../audit/audit.service';
import { paginate, PaginatedResponse } from '../common/dto/pagination.dto';
import { buildSlug } from '../common/utils/slug.util';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRegionDto } from './dto/create-region.dto';
import { RegionQueryDto } from './dto/region-query.dto';
import { UpdateRegionDto } from './dto/update-region.dto';
import { PublicRegionQueryDto } from './dto/public-region-query.dto';
import { UpsertRegionTranslationDto } from './dto/upsert-region-translation.dto';
import { nonEmptyEditorialText } from '../destinations/public-destination-editorial.util';
import {
  isRegionTranslationComplete,
  localizedPublicRegionSelect,
  publicRegionSelect,
  PublicRegion,
  PublicRegionEditorialTranslation,
  resolvePublicRegionEditorial,
} from './public-region-editorial.util';

type RegionRecord = Awaited<
  ReturnType<PrismaService['region']['findFirstOrThrow']>
>;

const adminTranslationSelect = {
  locale: true,
  displayName: true,
  description: true,
  isPublished: true,
  publishedAt: true,
  updatedAt: true,
} satisfies Prisma.RegionTranslationSelect;

@Injectable()
export class RegionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async findPublic(
    query: PublicRegionQueryDto,
  ): Promise<PaginatedResponse<PublicRegion>> {
    const where: Prisma.RegionWhereInput = {
      status: LocationStatus.ACTIVE,
      ...this.searchWhere(query.q),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.region.findMany({
        where,
        select:
          query.locale === EditorialLocale.am
            ? localizedPublicRegionSelect
            : publicRegionSelect,
        orderBy: { name: 'asc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.region.count({ where }),
    ]);
    return paginate(
      data.map((record) => this.toPublic(record, query.locale)),
      total,
      query.page,
      query.limit,
    );
  }

  async findPublicBySlug(
    regionSlug: string,
    locale?: EditorialLocale,
  ): Promise<PublicRegion> {
    const region = await this.prisma.region.findFirst({
      where: { slug: regionSlug, status: LocationStatus.ACTIVE },
      select:
        locale === EditorialLocale.am
          ? localizedPublicRegionSelect
          : publicRegionSelect,
    });
    if (!region) throw new NotFoundException('Region not found.');
    return this.toPublic(region, locale);
  }

  async findAdmin(
    query: RegionQueryDto,
  ): Promise<PaginatedResponse<RegionRecord>> {
    const where: Prisma.RegionWhereInput = {
      status: query.status,
      ...this.searchWhere(query.q),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.region.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.region.count({ where }),
    ]);
    return paginate(data, total, query.page, query.limit);
  }

  async findAdminById(id: string): Promise<RegionRecord> {
    const region = await this.prisma.region.findUnique({ where: { id } });
    if (!region) throw new NotFoundException('Region not found.');
    return region;
  }

  async create(dto: CreateRegionDto): Promise<RegionRecord> {
    const slug = dto.slug ?? buildSlug(dto.name);
    await this.ensureSlugAvailable(slug);
    try {
      return await this.prisma.region.create({ data: { ...dto, slug } });
    } catch (error) {
      this.throwConflictOnDuplicate(error);
      throw error;
    }
  }

  async update(
    id: string,
    dto: UpdateRegionDto,
    actorUserId?: string,
    context: AuditContext = {},
  ): Promise<RegionRecord> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await this.lockRegion(tx, id);
        if (
          existing.status === LocationStatus.ARCHIVED &&
          dto.status &&
          dto.status !== LocationStatus.ARCHIVED
        )
          throw new ConflictException('Archived regions cannot be restored.');

        const slug = dto.slug ?? (dto.name ? buildSlug(dto.name) : undefined);
        if (slug && slug !== existing.slug)
          await this.ensureSlugAvailable(slug, tx);
        const sourceChanged =
          (dto.name !== undefined && dto.name !== existing.name) ||
          (dto.description !== undefined &&
            dto.description !== existing.description);
        const updated = await tx.region.update({
          where: { id },
          data: { ...dto, slug },
        });
        if (sourceChanged) {
          const published = await tx.regionTranslation.findMany({
            where: { regionId: id, isPublished: true },
            select: { locale: true },
          });
          if (published.length) {
            await tx.regionTranslation.updateMany({
              where: { regionId: id, isPublished: true },
              data: { isPublished: false, publishedAt: null },
            });
            for (const { locale } of published) {
              await this.audit.record(tx, {
                ...context,
                actorUserId,
                entityId: id,
                entityType: AUDIT_ENTITY_TYPES.REGION,
                action: AUDIT_ACTIONS.ADMIN_REGION_TRANSLATION_INVALIDATED,
                reason: 'source_changed',
                metadata: {
                  regionId: id,
                  locale,
                  operation: 'source_changed',
                  previousStatus: 'PUBLISHED',
                  nextStatus: 'DRAFT',
                },
              });
            }
          }
        }
        return updated;
      });
    } catch (error) {
      this.throwConflictOnDuplicate(error);
      throw error;
    }
  }

  async findTranslation(regionId: string, locale: EditorialLocale) {
    this.assertManagedLocale(locale);
    await this.findAdminById(regionId);
    const translation = await this.prisma.regionTranslation.findUnique({
      where: { regionId_locale: { regionId, locale } },
      select: adminTranslationSelect,
    });
    if (!translation)
      throw new NotFoundException('Region translation not found.');
    return translation;
  }

  async saveTranslation(
    regionId: string,
    locale: EditorialLocale,
    actorUserId: string,
    dto: UpsertRegionTranslationDto,
    context: AuditContext,
  ) {
    this.assertManagedLocale(locale);
    const values = {
      ...(dto.displayName !== undefined
        ? { displayName: nonEmptyEditorialText(dto.displayName) }
        : {}),
      ...(dto.description !== undefined
        ? { description: nonEmptyEditorialText(dto.description) }
        : {}),
    };
    return this.prisma.$transaction(async (tx) => {
      this.assertEditable(await this.lockRegion(tx, regionId));
      const translation = await tx.regionTranslation.upsert({
        where: { regionId_locale: { regionId, locale } },
        create: {
          regionId,
          locale,
          ...values,
          isPublished: false,
          publishedAt: null,
        },
        update: { ...values, isPublished: false, publishedAt: null },
        select: adminTranslationSelect,
      });
      await this.audit.record(tx, {
        ...context,
        actorUserId,
        entityId: regionId,
        entityType: AUDIT_ENTITY_TYPES.REGION,
        action: AUDIT_ACTIONS.ADMIN_REGION_TRANSLATION_SAVED,
        metadata: { regionId, locale },
      });
      return translation;
    });
  }

  async publishTranslation(
    regionId: string,
    locale: EditorialLocale,
    actorUserId: string,
    context: AuditContext,
  ) {
    this.assertManagedLocale(locale);
    return this.prisma.$transaction(async (tx) => {
      const source = await this.lockRegion(tx, regionId);
      this.assertEditable(source);
      const translation = await tx.regionTranslation.findUnique({
        where: { regionId_locale: { regionId, locale } },
        select: adminTranslationSelect,
      });
      if (!translation)
        throw new NotFoundException('Region translation not found.');
      if (!isRegionTranslationComplete(source, translation)) {
        throw new BadRequestException(
          'Publishing requires a display name and a translated description when the source has one.',
        );
      }
      const published = await tx.regionTranslation.update({
        where: { regionId_locale: { regionId, locale } },
        data: { isPublished: true, publishedAt: new Date() },
        select: adminTranslationSelect,
      });
      await this.audit.record(tx, {
        ...context,
        actorUserId,
        entityId: regionId,
        entityType: AUDIT_ENTITY_TYPES.REGION,
        action: AUDIT_ACTIONS.ADMIN_REGION_TRANSLATION_PUBLISHED,
        metadata: { regionId, locale },
      });
      return published;
    });
  }

  async unpublishTranslation(
    regionId: string,
    locale: EditorialLocale,
    actorUserId: string,
    context: AuditContext,
  ) {
    this.assertManagedLocale(locale);
    return this.prisma.$transaction(async (tx) => {
      await this.lockRegion(tx, regionId);
      const translation = await tx.regionTranslation.findUnique({
        where: { regionId_locale: { regionId, locale } },
        select: adminTranslationSelect,
      });
      if (!translation)
        throw new NotFoundException('Region translation not found.');
      const unpublished = await tx.regionTranslation.update({
        where: { regionId_locale: { regionId, locale } },
        data: { isPublished: false, publishedAt: null },
        select: adminTranslationSelect,
      });
      await this.audit.record(tx, {
        ...context,
        actorUserId,
        entityId: regionId,
        entityType: AUDIT_ENTITY_TYPES.REGION,
        action: AUDIT_ACTIONS.ADMIN_REGION_TRANSLATION_UNPUBLISHED,
        metadata: { regionId, locale },
      });
      return unpublished;
    });
  }

  private toPublic(
    record: PublicRegion & {
      translations?: PublicRegionEditorialTranslation[];
    },
    locale: EditorialLocale | undefined,
  ): PublicRegion {
    const { translations, ...source } = record;
    return resolvePublicRegionEditorial(source, locale, translations?.[0]);
  }

  private assertManagedLocale(locale: EditorialLocale): void {
    if (locale !== EditorialLocale.am) {
      throw new BadRequestException(
        'Only Amharic translations are managed; English is canonical.',
      );
    }
  }

  private assertEditable(region: RegionRecord): void {
    if (region.status === LocationStatus.ARCHIVED) {
      throw new ConflictException(
        'Archived regions cannot save or publish translations.',
      );
    }
  }

  private async lockRegion(
    tx: Prisma.TransactionClient,
    id: string,
  ): Promise<RegionRecord> {
    // All source edits and translation mutations use the same parent lock. A
    // publisher cannot approve old source while an edit invalidates translations.
    await tx.$queryRaw(
      Prisma.sql`SELECT id FROM regions WHERE id = ${id}::uuid FOR UPDATE`,
    );
    const region = await tx.region.findUnique({ where: { id } });
    if (!region) throw new NotFoundException('Region not found.');
    return region;
  }

  private searchWhere(q?: string): Prisma.RegionWhereInput {
    return q ? { name: { contains: q, mode: 'insensitive' } } : {};
  }

  private async ensureSlugAvailable(
    slug: string,
    client: Pick<Prisma.TransactionClient, 'region'> = this.prisma,
  ): Promise<void> {
    const existing = await client.region.findUnique({ where: { slug } });
    if (existing) throw new ConflictException('Region slug already exists.');
  }

  private throwConflictOnDuplicate(error: unknown): void {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException('Region slug already exists.');
    }
  }
}
