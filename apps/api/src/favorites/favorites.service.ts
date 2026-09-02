import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma, UserStatus } from '@prisma/client';
import { paginate, PaginatedResponse } from '../common/dto/pagination.dto';
import {
  publicAttractionWhere,
  publicBusinessWhere,
  publicDestinationWhere,
  publicServiceWhere,
} from '../common/utils/public-visibility.util';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFavoriteDto } from './dto/create-favorite.dto';
import { FavoriteQueryDto } from './dto/favorite-query.dto';
import { FavoriteTargetType } from './dto/favorite-target-type.enum';

const favoriteSelect = Prisma.validator<Prisma.FavoriteSelect>()({
  id: true,
  createdAt: true,
  business: {
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      category: { select: { code: true, name: true } },
      city: {
        select: {
          name: true,
          slug: true,
          region: { select: { name: true, slug: true } },
        },
      },
      destination: { select: { name: true, slug: true } },
    },
  },
  service: {
    select: {
      id: true,
      name: true,
      slug: true,
      shortDescription: true,
      pricingModel: true,
      price: true,
      currency: true,
      category: { select: { code: true, name: true } },
      business: {
        select: {
          name: true,
          slug: true,
          city: {
            select: {
              name: true,
              slug: true,
              region: { select: { name: true, slug: true } },
            },
          },
          destination: { select: { name: true, slug: true } },
        },
      },
    },
  },
  destination: {
    select: {
      id: true,
      name: true,
      slug: true,
      shortDescription: true,
      city: {
        select: {
          name: true,
          slug: true,
          region: { select: { name: true, slug: true } },
        },
      },
    },
  },
  attraction: {
    select: {
      id: true,
      name: true,
      slug: true,
      category: true,
      description: true,
      destination: {
        select: {
          name: true,
          slug: true,
          city: {
            select: {
              name: true,
              slug: true,
              region: { select: { name: true, slug: true } },
            },
          },
        },
      },
    },
  },
});

type FavoriteRecord = Prisma.FavoriteGetPayload<{
  select: typeof favoriteSelect;
}>;
type FavoriteCreateData = Pick<
  Prisma.FavoriteUncheckedCreateInput,
  'userId' | 'businessId' | 'serviceId' | 'destinationId' | 'attractionId'
>;

type FavoriteTargetSummary =
  | {
      type: FavoriteTargetType.BUSINESS;
      id: string;
      name: string;
      slug: string;
      description: string;
      category: { code: string; name: string };
      city: { name: string; slug: string };
      region: { name: string; slug: string };
      destination: { name: string; slug: string } | null;
    }
  | {
      type: FavoriteTargetType.SERVICE;
      id: string;
      name: string;
      slug: string;
      shortDescription: string;
      pricingModel: string;
      price: Prisma.Decimal | null;
      currency: string | null;
      category: { code: string; name: string };
      business: { name: string; slug: string };
      city: { name: string; slug: string };
      region: { name: string; slug: string };
      destination: { name: string; slug: string } | null;
    }
  | {
      type: FavoriteTargetType.DESTINATION;
      id: string;
      name: string;
      slug: string;
      shortDescription: string;
      city: { name: string; slug: string };
      region: { name: string; slug: string };
    }
  | {
      type: FavoriteTargetType.ATTRACTION;
      id: string;
      name: string;
      slug: string;
      category: string;
      description: string;
      destination: { name: string; slug: string };
      city: { name: string; slug: string };
      region: { name: string; slug: string };
    };

export interface FavoriteResponseDto {
  id: string;
  createdAt: Date;
  target: FavoriteTargetSummary;
}

@Injectable()
export class FavoritesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    userId: string,
    dto: CreateFavoriteDto,
  ): Promise<FavoriteResponseDto> {
    await this.ensureActiveUser(userId);
    await this.ensureTargetIsPublic(dto.targetType, dto.targetId);

    try {
      const favorite = await this.prisma.favorite.create({
        data: this.createData(userId, dto),
        select: { id: true },
      });
      return this.findOwnedVisibleFavorite(userId, favorite.id);
    } catch (error) {
      this.throwDuplicateConflict(error);
      throw error;
    }
  }

  async findMine(
    userId: string,
    query: FavoriteQueryDto,
  ): Promise<PaginatedResponse<FavoriteResponseDto>> {
    await this.ensureActiveUser(userId);
    const where = this.visibleFavoriteWhere(userId, query.targetType);
    const [records, total] = await this.prisma.$transaction([
      this.prisma.favorite.findMany({
        where,
        select: favoriteSelect,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.favorite.count({ where }),
    ]);

    return paginate(
      records.map((record) => this.toResponse(record)),
      total,
      query.page,
      query.limit,
    );
  }

  async remove(userId: string, favoriteId: string): Promise<void> {
    await this.ensureActiveUser(userId);
    const result = await this.prisma.favorite.deleteMany({
      where: { id: favoriteId, userId },
    });
    if (result.count === 0) throw new NotFoundException('Favorite not found.');
  }

  private async ensureActiveUser(userId: string): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, status: UserStatus.ACTIVE },
      select: { id: true },
    });
    if (!user) throw new UnauthorizedException('Authentication required.');
  }

  private async ensureTargetIsPublic(
    targetType: FavoriteTargetType,
    targetId: string,
  ): Promise<void> {
    const exists = await this.targetExists(targetType, targetId);
    if (!exists) throw new NotFoundException('Favorite target not found.');
  }

  private async targetExists(
    targetType: FavoriteTargetType,
    targetId: string,
  ): Promise<boolean> {
    switch (targetType) {
      case FavoriteTargetType.BUSINESS:
        return Boolean(
          await this.prisma.business.findFirst({
            where: { id: targetId, ...publicBusinessWhere() },
            select: { id: true },
          }),
        );
      case FavoriteTargetType.SERVICE:
        return Boolean(
          await this.prisma.service.findFirst({
            where: { id: targetId, ...publicServiceWhere() },
            select: { id: true },
          }),
        );
      case FavoriteTargetType.DESTINATION:
        return Boolean(
          await this.prisma.destination.findFirst({
            where: { id: targetId, ...publicDestinationWhere() },
            select: { id: true },
          }),
        );
      case FavoriteTargetType.ATTRACTION:
        return Boolean(
          await this.prisma.attraction.findFirst({
            where: { id: targetId, ...publicAttractionWhere() },
            select: { id: true },
          }),
        );
    }
  }

  private createData(
    userId: string,
    dto: CreateFavoriteDto,
  ): FavoriteCreateData {
    const base = { userId };
    switch (dto.targetType) {
      case FavoriteTargetType.BUSINESS:
        return { ...base, businessId: dto.targetId };
      case FavoriteTargetType.SERVICE:
        return { ...base, serviceId: dto.targetId };
      case FavoriteTargetType.DESTINATION:
        return { ...base, destinationId: dto.targetId };
      case FavoriteTargetType.ATTRACTION:
        return { ...base, attractionId: dto.targetId };
    }
  }

  private visibleFavoriteWhere(
    userId: string,
    targetType?: FavoriteTargetType,
  ): Prisma.FavoriteWhereInput {
    const targetWhere = this.visibleTargetWhere(targetType);
    return {
      userId,
      ...(targetType ? targetWhere : { OR: targetWhere.OR }),
    };
  }

  private visibleTargetWhere(
    targetType?: FavoriteTargetType,
  ): Prisma.FavoriteWhereInput {
    switch (targetType) {
      case FavoriteTargetType.BUSINESS:
        return { businessId: { not: null }, business: publicBusinessWhere() };
      case FavoriteTargetType.SERVICE:
        return { serviceId: { not: null }, service: publicServiceWhere() };
      case FavoriteTargetType.DESTINATION:
        return {
          destinationId: { not: null },
          destination: publicDestinationWhere(),
        };
      case FavoriteTargetType.ATTRACTION:
        return {
          attractionId: { not: null },
          attraction: publicAttractionWhere(),
        };
      default:
        return {
          OR: [
            { businessId: { not: null }, business: publicBusinessWhere() },
            { serviceId: { not: null }, service: publicServiceWhere() },
            {
              destinationId: { not: null },
              destination: publicDestinationWhere(),
            },
            {
              attractionId: { not: null },
              attraction: publicAttractionWhere(),
            },
          ],
        };
    }
  }

  private async findOwnedVisibleFavorite(
    userId: string,
    favoriteId: string,
  ): Promise<FavoriteResponseDto> {
    const favorite = await this.prisma.favorite.findFirst({
      where: { id: favoriteId, ...this.visibleFavoriteWhere(userId) },
      select: favoriteSelect,
    });
    if (!favorite) throw new NotFoundException('Favorite not found.');
    return this.toResponse(favorite);
  }

  private toResponse(favorite: FavoriteRecord): FavoriteResponseDto {
    return {
      id: favorite.id,
      createdAt: favorite.createdAt,
      target: this.toTarget(favorite),
    };
  }

  private toTarget(favorite: FavoriteRecord): FavoriteTargetSummary {
    if (favorite.business) {
      return {
        type: FavoriteTargetType.BUSINESS,
        id: favorite.business.id,
        name: favorite.business.name,
        slug: favorite.business.slug,
        description: favorite.business.description,
        category: favorite.business.category,
        city: {
          name: favorite.business.city.name,
          slug: favorite.business.city.slug,
        },
        region: favorite.business.city.region,
        destination: favorite.business.destination,
      };
    }

    if (favorite.service) {
      return {
        type: FavoriteTargetType.SERVICE,
        id: favorite.service.id,
        name: favorite.service.name,
        slug: favorite.service.slug,
        shortDescription: favorite.service.shortDescription,
        pricingModel: favorite.service.pricingModel,
        price: favorite.service.price,
        currency: favorite.service.currency,
        category: favorite.service.category,
        business: {
          name: favorite.service.business.name,
          slug: favorite.service.business.slug,
        },
        city: {
          name: favorite.service.business.city.name,
          slug: favorite.service.business.city.slug,
        },
        region: favorite.service.business.city.region,
        destination: favorite.service.business.destination,
      };
    }

    if (favorite.destination) {
      return {
        type: FavoriteTargetType.DESTINATION,
        id: favorite.destination.id,
        name: favorite.destination.name,
        slug: favorite.destination.slug,
        shortDescription: favorite.destination.shortDescription,
        city: {
          name: favorite.destination.city.name,
          slug: favorite.destination.city.slug,
        },
        region: favorite.destination.city.region,
      };
    }

    if (favorite.attraction) {
      return {
        type: FavoriteTargetType.ATTRACTION,
        id: favorite.attraction.id,
        name: favorite.attraction.name,
        slug: favorite.attraction.slug,
        category: favorite.attraction.category,
        description: favorite.attraction.description,
        destination: {
          name: favorite.attraction.destination.name,
          slug: favorite.attraction.destination.slug,
        },
        city: {
          name: favorite.attraction.destination.city.name,
          slug: favorite.attraction.destination.city.slug,
        },
        region: favorite.attraction.destination.city.region,
      };
    }

    throw new NotFoundException('Favorite target not found.');
  }

  private throwDuplicateConflict(error: unknown): void {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException('Favorite already exists.');
    }
  }
}
