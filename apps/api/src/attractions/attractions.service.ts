import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AttractionCategory,
  LocationStatus,
  Prisma,
  PublicationStatus,
} from '@prisma/client';
import {
  paginate,
  PaginatedResponse,
  PaginationQueryDto,
} from '../common/dto/pagination.dto';
import { buildSlug } from '../common/utils/slug.util';
import { PrismaService } from '../prisma/prisma.service';
import { AttractionQueryDto } from './dto/attraction-query.dto';
import { CreateAttractionDto } from './dto/create-attraction.dto';
import { UpdateAttractionDto } from './dto/update-attraction.dto';

type AttractionRecord = Awaited<
  ReturnType<PrismaService['attraction']['findFirstOrThrow']>
>;

@Injectable()
export class AttractionsService {
  constructor(private readonly prisma: PrismaService) {}

  async findPublic(
    query: PaginationQueryDto & {
      destinationId?: string;
      category?: AttractionCategory;
    },
  ): Promise<PaginatedResponse<AttractionRecord>> {
    const where: Prisma.AttractionWhereInput = {
      category: query.category,
      destinationId: query.destinationId,
      status: PublicationStatus.PUBLISHED,
      destination: {
        status: PublicationStatus.PUBLISHED,
        city: {
          status: LocationStatus.ACTIVE,
          region: { status: LocationStatus.ACTIVE },
        },
      },
      ...this.searchWhere(query.q),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.attraction.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.attraction.count({ where }),
    ]);
    return paginate(data, total, query.page, query.limit);
  }

  async findPublicByDestinationSlugs(
    regionSlug: string,
    citySlug: string,
    destinationSlug: string,
    query: PaginationQueryDto,
  ): Promise<PaginatedResponse<AttractionRecord>> {
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
    return this.findPublic({ ...query, destinationId: destination.id });
  }

  async findPublicBySlugs(
    regionSlug: string,
    citySlug: string,
    destinationSlug: string,
    attractionSlug: string,
  ): Promise<AttractionRecord> {
    const attraction = await this.prisma.attraction.findFirst({
      where: {
        slug: attractionSlug,
        status: PublicationStatus.PUBLISHED,
        destination: {
          slug: destinationSlug,
          status: PublicationStatus.PUBLISHED,
          city: {
            slug: citySlug,
            status: LocationStatus.ACTIVE,
            region: { slug: regionSlug, status: LocationStatus.ACTIVE },
          },
        },
      },
    });
    if (!attraction) throw new NotFoundException('Attraction not found.');
    return attraction;
  }

  async findAdmin(
    query: AttractionQueryDto,
  ): Promise<PaginatedResponse<AttractionRecord>> {
    const where: Prisma.AttractionWhereInput = {
      category: query.category,
      destinationId: query.destinationId,
      status: query.status,
      ...this.searchWhere(query.q),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.attraction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.attraction.count({ where }),
    ]);
    return paginate(data, total, query.page, query.limit);
  }

  async findAdminById(id: string): Promise<AttractionRecord> {
    const attraction = await this.prisma.attraction.findUnique({
      where: { id },
    });
    if (!attraction) throw new NotFoundException('Attraction not found.');
    return attraction;
  }

  async create(dto: CreateAttractionDto): Promise<AttractionRecord> {
    this.validateMoney(dto.entranceFee, dto.currency);
    await this.ensureDestinationExists(dto.destinationId);
    if (dto.status === PublicationStatus.PUBLISHED)
      await this.ensureDestinationPublishable(dto.destinationId);
    const slug = dto.slug ?? buildSlug(dto.name);
    await this.ensureSlugAvailable(dto.destinationId, slug);
    const now = new Date();
    try {
      return await this.prisma.attraction.create({
        data: this.createData(dto, slug, now),
      });
    } catch (error) {
      this.throwConflictOnDuplicate(error);
      throw error;
    }
  }

  async update(
    id: string,
    dto: UpdateAttractionDto,
  ): Promise<AttractionRecord> {
    const existing = await this.findAdminById(id);
    if (
      existing.status === PublicationStatus.ARCHIVED &&
      dto.status &&
      dto.status !== PublicationStatus.ARCHIVED
    ) {
      throw new ConflictException('Archived attractions cannot be restored.');
    }
    const destinationId = dto.destinationId ?? existing.destinationId;
    if (dto.destinationId)
      await this.ensureDestinationExists(dto.destinationId);
    if (dto.status === PublicationStatus.PUBLISHED)
      await this.ensureDestinationPublishable(destinationId);
    const nextFee =
      dto.entranceFee ??
      (existing.entranceFee ? Number(existing.entranceFee) : undefined);
    const nextCurrency = dto.currency ?? existing.currency ?? undefined;
    this.validateMoney(nextFee, nextCurrency);
    const slug = dto.slug ?? (dto.name ? buildSlug(dto.name) : undefined);
    if (
      slug &&
      (slug !== existing.slug || destinationId !== existing.destinationId)
    )
      await this.ensureSlugAvailable(destinationId, slug, id);
    const now = new Date();
    try {
      return await this.prisma.attraction.update({
        where: { id },
        data: this.updateData(dto, slug, existing, now),
      });
    } catch (error) {
      this.throwConflictOnDuplicate(error);
      throw error;
    }
  }

  private createData(
    dto: CreateAttractionDto,
    slug: string,
    now: Date,
  ): Prisma.AttractionCreateInput {
    const status = dto.status ?? PublicationStatus.DRAFT;
    return {
      category: dto.category,
      contactInfo: dto.contactInfo
        ? (dto.contactInfo as Prisma.InputJsonObject)
        : undefined,
      currency: dto.currency,
      description: dto.description,
      destination: { connect: { id: dto.destinationId } },
      entranceFee: dto.entranceFee,
      latitude: dto.latitude,
      longitude: dto.longitude,
      name: dto.name,
      openingInfo: dto.openingInfo
        ? (dto.openingInfo as Prisma.InputJsonObject)
        : undefined,
      slug,
      status,
      publishedAt: status === PublicationStatus.PUBLISHED ? now : undefined,
      archivedAt: status === PublicationStatus.ARCHIVED ? now : undefined,
    };
  }

  private updateData(
    dto: UpdateAttractionDto,
    slug: string | undefined,
    existing: AttractionRecord,
    now: Date,
  ): Prisma.AttractionUpdateInput {
    const status = dto.status;
    return {
      category: dto.category,
      contactInfo: dto.contactInfo
        ? (dto.contactInfo as Prisma.InputJsonObject)
        : undefined,
      currency: dto.currency,
      description: dto.description,
      destination: dto.destinationId
        ? { connect: { id: dto.destinationId } }
        : undefined,
      entranceFee: dto.entranceFee,
      latitude: dto.latitude,
      longitude: dto.longitude,
      name: dto.name,
      openingInfo: dto.openingInfo
        ? (dto.openingInfo as Prisma.InputJsonObject)
        : undefined,
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
    };
  }

  private validateMoney(
    entranceFee: number | undefined,
    currency: string | undefined,
  ): void {
    if (entranceFee !== undefined && !currency) {
      throw new BadRequestException(
        'Currency is required when entrance fee is present.',
      );
    }
  }

  private searchWhere(q?: string): Prisma.AttractionWhereInput {
    return q
      ? {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
          ],
        }
      : {};
  }

  private async ensureDestinationExists(destinationId: string): Promise<void> {
    const destination = await this.prisma.destination.findUnique({
      where: { id: destinationId },
    });
    if (!destination) throw new NotFoundException('Destination not found.');
  }

  private async ensureDestinationPublishable(
    destinationId: string,
  ): Promise<void> {
    const destination = await this.prisma.destination.findFirst({
      where: {
        id: destinationId,
        status: PublicationStatus.PUBLISHED,
        city: {
          status: LocationStatus.ACTIVE,
          region: { status: LocationStatus.ACTIVE },
        },
      },
    });
    if (!destination)
      throw new ConflictException(
        'Attraction cannot be published unless its destination, city, and region are public.',
      );
  }

  private async ensureSlugAvailable(
    destinationId: string,
    slug: string,
    ignoreId?: string,
  ): Promise<void> {
    const existing = await this.prisma.attraction.findUnique({
      where: { destinationId_slug: { destinationId, slug } },
    });
    if (existing && existing.id !== ignoreId)
      throw new ConflictException(
        'Attraction slug already exists within this destination.',
      );
  }

  private throwConflictOnDuplicate(error: unknown): void {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(
        'Attraction slug already exists within this destination.',
      );
    }
  }
}
