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
import { CityQueryDto } from './dto/city-query.dto';
import { CreateCityDto } from './dto/create-city.dto';
import { UpdateCityDto } from './dto/update-city.dto';

type CityRecord = Awaited<
  ReturnType<PrismaService['city']['findFirstOrThrow']>
>;

@Injectable()
export class CitiesService {
  constructor(private readonly prisma: PrismaService) {}

  async findPublic(
    query: PaginationQueryDto & { regionId?: string },
  ): Promise<PaginatedResponse<CityRecord>> {
    const where: Prisma.CityWhereInput = {
      regionId: query.regionId,
      status: LocationStatus.ACTIVE,
      region: { status: LocationStatus.ACTIVE },
      ...this.searchWhere(query.q),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.city.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.city.count({ where }),
    ]);
    return paginate(data, total, query.page, query.limit);
  }

  async findPublicByRegion(
    regionSlug: string,
    query: PaginationQueryDto,
  ): Promise<PaginatedResponse<CityRecord>> {
    const region = await this.prisma.region.findFirst({
      where: { slug: regionSlug, status: LocationStatus.ACTIVE },
    });
    if (!region) throw new NotFoundException('Region not found.');
    return this.findPublic({ ...query, regionId: region.id });
  }

  async findPublicBySlugs(
    regionSlug: string,
    citySlug: string,
  ): Promise<CityRecord> {
    const city = await this.prisma.city.findFirst({
      where: {
        slug: citySlug,
        status: LocationStatus.ACTIVE,
        region: { slug: regionSlug, status: LocationStatus.ACTIVE },
      },
    });
    if (!city) throw new NotFoundException('City not found.');
    return city;
  }

  async findAdmin(query: CityQueryDto): Promise<PaginatedResponse<CityRecord>> {
    const where: Prisma.CityWhereInput = {
      regionId: query.regionId,
      status: query.status,
      ...this.searchWhere(query.q),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.city.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.city.count({ where }),
    ]);
    return paginate(data, total, query.page, query.limit);
  }

  async findAdminById(id: string): Promise<CityRecord> {
    const city = await this.prisma.city.findUnique({ where: { id } });
    if (!city) throw new NotFoundException('City not found.');
    return city;
  }

  async create(dto: CreateCityDto): Promise<CityRecord> {
    await this.ensureRegionExists(dto.regionId);
    const slug = dto.slug ?? buildSlug(dto.name);
    await this.ensureSlugAvailable(dto.regionId, slug);
    try {
      return await this.prisma.city.create({ data: { ...dto, slug } });
    } catch (error) {
      this.throwConflictOnDuplicate(error);
      throw error;
    }
  }

  async update(id: string, dto: UpdateCityDto): Promise<CityRecord> {
    const existing = await this.findAdminById(id);
    if (
      existing.status === LocationStatus.ARCHIVED &&
      dto.status &&
      dto.status !== LocationStatus.ARCHIVED
    ) {
      throw new ConflictException('Archived cities cannot be restored.');
    }
    const regionId = dto.regionId ?? existing.regionId;
    if (dto.regionId) await this.ensureRegionExists(dto.regionId);
    const slug = dto.slug ?? (dto.name ? buildSlug(dto.name) : undefined);
    if (slug && (slug !== existing.slug || regionId !== existing.regionId))
      await this.ensureSlugAvailable(regionId, slug, id);
    try {
      return await this.prisma.city.update({
        where: { id },
        data: { ...dto, slug },
      });
    } catch (error) {
      this.throwConflictOnDuplicate(error);
      throw error;
    }
  }

  private searchWhere(q?: string): Prisma.CityWhereInput {
    return q ? { name: { contains: q, mode: 'insensitive' } } : {};
  }

  private async ensureRegionExists(regionId: string): Promise<void> {
    const region = await this.prisma.region.findUnique({
      where: { id: regionId },
    });
    if (!region) throw new NotFoundException('Region not found.');
  }

  private async ensureSlugAvailable(
    regionId: string,
    slug: string,
    ignoreId?: string,
  ): Promise<void> {
    const existing = await this.prisma.city.findUnique({
      where: { regionId_slug: { regionId, slug } },
    });
    if (existing && existing.id !== ignoreId)
      throw new ConflictException(
        'City slug already exists within this region.',
      );
  }

  private throwConflictOnDuplicate(error: unknown): void {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(
        'City slug already exists within this region.',
      );
    }
  }
}
