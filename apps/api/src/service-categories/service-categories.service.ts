import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from '../audit/audit.constants';
import { AuditContext, AuditService } from '../audit/audit.service';
import { paginate, PaginatedResponse } from '../common/dto/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';
import { ServiceCategoryQueryDto } from './dto/service-category-query.dto';
import { CreateServiceCategoryDto } from './dto/create-service-category.dto';
import { UpdateServiceCategoryDto } from './dto/update-service-category.dto';

type CategoryRecord = Awaited<
  ReturnType<PrismaService['serviceCategory']['findFirstOrThrow']>
>;

@Injectable()
export class ServiceCategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit?: AuditService,
  ) {}

  async findPublic(
    query: ServiceCategoryQueryDto,
  ): Promise<PaginatedResponse<CategoryRecord>> {
    const where: Prisma.ServiceCategoryWhereInput = {
      isActive: true,
      ...this.searchWhere(query.q),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.serviceCategory.findMany({
        where,
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.serviceCategory.count({ where }),
    ]);
    return paginate(data, total, query.page, query.limit);
  }

  async findAdmin(
    query: ServiceCategoryQueryDto,
  ): Promise<PaginatedResponse<CategoryRecord>> {
    const where: Prisma.ServiceCategoryWhereInput = {
      isActive: query.isActive,
      ...this.searchWhere(query.q),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.serviceCategory.findMany({
        where,
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.serviceCategory.count({ where }),
    ]);
    return paginate(data, total, query.page, query.limit);
  }

  async create(dto: CreateServiceCategoryDto): Promise<CategoryRecord> {
    try {
      return await this.prisma.serviceCategory.create({
        data: { ...dto, code: dto.code.toUpperCase().trim() },
      });
    } catch (error) {
      this.throwConflict(error);
      throw error;
    }
  }

  async update(
    id: string,
    dto: UpdateServiceCategoryDto,
  ): Promise<CategoryRecord> {
    await this.findAdminById(id);
    try {
      return await this.prisma.serviceCategory.update({
        where: { id },
        data: { ...dto, code: dto.code?.toUpperCase().trim() },
      });
    } catch (error) {
      this.throwConflict(error);
      throw error;
    }
  }

  async createAdmin(
    actorUserId: string,
    dto: CreateServiceCategoryDto,
    context: AuditContext,
  ): Promise<CategoryRecord> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const category = await tx.serviceCategory.create({
          data: { ...dto, code: dto.code.toUpperCase().trim() },
        });
        await this.audit?.record(tx, {
          ...context,
          action: AUDIT_ACTIONS.ADMIN_SERVICE_CATEGORY_CREATED,
          actorUserId,
          entityId: category.id,
          entityType: AUDIT_ENTITY_TYPES.SERVICE_CATEGORY,
          metadata: {
            categoryType: 'SERVICE',
            nextStatus: category.isActive ? 'ACTIVE' : 'INACTIVE',
          },
        });
        return category;
      });
    } catch (error) {
      this.throwConflict(error);
      throw error;
    }
  }

  async updateAdmin(
    id: string,
    actorUserId: string,
    dto: UpdateServiceCategoryDto,
    context: AuditContext,
  ): Promise<CategoryRecord> {
    await this.findAdminById(id);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const category = await tx.serviceCategory.update({
          where: { id },
          data: { ...dto, code: dto.code?.toUpperCase().trim() },
        });
        await this.audit?.record(tx, {
          ...context,
          action: AUDIT_ACTIONS.ADMIN_SERVICE_CATEGORY_UPDATED,
          actorUserId,
          entityId: id,
          entityType: AUDIT_ENTITY_TYPES.SERVICE_CATEGORY,
          metadata: {
            categoryType: 'SERVICE',
            nextStatus: category.isActive ? 'ACTIVE' : 'INACTIVE',
          },
        });
        return category;
      });
    } catch (error) {
      this.throwConflict(error);
      throw error;
    }
  }

  private async findAdminById(id: string): Promise<CategoryRecord> {
    const category = await this.prisma.serviceCategory.findUnique({
      where: { id },
    });
    if (!category) throw new NotFoundException('Service category not found.');
    return category;
  }

  private searchWhere(q?: string): Prisma.ServiceCategoryWhereInput {
    return q
      ? {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { code: { contains: q, mode: 'insensitive' } },
          ],
        }
      : {};
  }

  private throwConflict(error: unknown): void {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    )
      throw new ConflictException('Service category code already exists.');
  }
}
