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
import { BusinessCategoryQueryDto } from './dto/business-category-query.dto';
import { CreateBusinessCategoryDto } from './dto/create-business-category.dto';
import { UpdateBusinessCategoryDto } from './dto/update-business-category.dto';

type CategoryRecord = Awaited<
  ReturnType<PrismaService['businessCategory']['findFirstOrThrow']>
>;

@Injectable()
export class BusinessCategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit?: AuditService,
  ) {}

  async findPublic(
    query: BusinessCategoryQueryDto,
  ): Promise<PaginatedResponse<CategoryRecord>> {
    const where: Prisma.BusinessCategoryWhereInput = {
      isActive: true,
      ...this.searchWhere(query.q),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.businessCategory.findMany({
        where,
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.businessCategory.count({ where }),
    ]);
    return paginate(data, total, query.page, query.limit);
  }

  async findAdmin(
    query: BusinessCategoryQueryDto,
  ): Promise<PaginatedResponse<CategoryRecord>> {
    const where: Prisma.BusinessCategoryWhereInput = {
      isActive: query.isActive,
      ...this.searchWhere(query.q),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.businessCategory.findMany({
        where,
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.businessCategory.count({ where }),
    ]);
    return paginate(data, total, query.page, query.limit);
  }

  async create(dto: CreateBusinessCategoryDto): Promise<CategoryRecord> {
    try {
      return await this.prisma.businessCategory.create({
        data: { ...dto, code: dto.code.toUpperCase().trim() },
      });
    } catch (error) {
      this.throwConflict(error);
      throw error;
    }
  }

  async update(
    id: string,
    dto: UpdateBusinessCategoryDto,
  ): Promise<CategoryRecord> {
    await this.findAdminById(id);
    try {
      return await this.prisma.businessCategory.update({
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
    dto: CreateBusinessCategoryDto,
    context: AuditContext,
  ): Promise<CategoryRecord> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const category = await tx.businessCategory.create({
          data: { ...dto, code: dto.code.toUpperCase().trim() },
        });
        await this.audit?.record(tx, {
          ...context,
          action: AUDIT_ACTIONS.ADMIN_BUSINESS_CATEGORY_CREATED,
          actorUserId,
          entityId: category.id,
          entityType: AUDIT_ENTITY_TYPES.BUSINESS_CATEGORY,
          metadata: {
            categoryType: 'BUSINESS',
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
    dto: UpdateBusinessCategoryDto,
    context: AuditContext,
  ): Promise<CategoryRecord> {
    await this.findAdminById(id);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const category = await tx.businessCategory.update({
          where: { id },
          data: { ...dto, code: dto.code?.toUpperCase().trim() },
        });
        await this.audit?.record(tx, {
          ...context,
          action: AUDIT_ACTIONS.ADMIN_BUSINESS_CATEGORY_UPDATED,
          actorUserId,
          entityId: id,
          entityType: AUDIT_ENTITY_TYPES.BUSINESS_CATEGORY,
          metadata: {
            categoryType: 'BUSINESS',
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

  async findAdminById(id: string): Promise<CategoryRecord> {
    const category = await this.prisma.businessCategory.findUnique({
      where: { id },
    });
    if (!category) throw new NotFoundException('Business category not found.');
    return category;
  }

  private searchWhere(q?: string): Prisma.BusinessCategoryWhereInput {
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
      throw new ConflictException('Business category code already exists.');
  }
}
