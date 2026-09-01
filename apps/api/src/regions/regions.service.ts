import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { LocationStatus, Prisma } from '@prisma/client';
import {
  paginate,
  PaginatedResponse,
  PaginationQueryDto,
} from '../common/dto/pagination.dto';
import { buildSlug } from '../common/utils/slug.util';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRegionDto } from './dto/create-region.dto';
import { RegionQueryDto } from './dto/region-query.dto';
import { UpdateRegionDto } from './dto/update-region.dto';

type RegionRecord = Awaited<
  ReturnType<PrismaService['region']['findFirstOrThrow']>
>;

@Injectable()
export class RegionsService {
  constructor(private readonly prisma: PrismaService) {}

  async findPublic(
    query: PaginationQueryDto,
  ): Promise<PaginatedResponse<RegionRecord>> {
    const where: Prisma.RegionWhereInput = {
      status: LocationStatus.ACTIVE,
      ...this.searchWhere(query.q),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.region.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.region.count({ where }),
    ]);
    return paginate(data, total, query.page, query.limit);
  }

  async findPublicBySlug(regionSlug: string): Promise<RegionRecord> {
    const region = await this.prisma.region.findFirst({
      where: { slug: regionSlug, status: LocationStatus.ACTIVE },
    });
    if (!region) throw new NotFoundException('Region not found.');
    return region;
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

  async update(id: string, dto: UpdateRegionDto): Promise<RegionRecord> {
    const existing = await this.findAdminById(id);
    if (
      existing.status === LocationStatus.ARCHIVED &&
      dto.status &&
      dto.status !== LocationStatus.ARCHIVED
    ) {
      throw new ConflictException('Archived regions cannot be restored.');
    }
    const slug = dto.slug ?? (dto.name ? buildSlug(dto.name) : undefined);
    if (slug && slug !== existing.slug) await this.ensureSlugAvailable(slug);
    try {
      return await this.prisma.region.update({
        where: { id },
        data: { ...dto, slug },
      });
    } catch (error) {
      this.throwConflictOnDuplicate(error);
      throw error;
    }
  }

  private searchWhere(q?: string): Prisma.RegionWhereInput {
    return q ? { name: { contains: q, mode: 'insensitive' } } : {};
  }

  private async ensureSlugAvailable(slug: string): Promise<void> {
    const existing = await this.prisma.region.findUnique({ where: { slug } });
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
