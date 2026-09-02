import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma, ReviewStatus, UserStatus } from '@prisma/client';
import { paginate, PaginatedResponse } from '../common/dto/pagination.dto';
import {
  publicAttractionWhere,
  publicBusinessWhere,
  publicDestinationWhere,
  publicServiceWhere,
} from '../common/utils/public-visibility.util';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReviewDto } from './dto/create-review.dto';
import {
  MyReviewQueryDto,
  PublicReviewQueryDto,
  PublicReviewSort,
  ReviewSummaryQueryDto,
} from './dto/review-query.dto';
import { ReviewTargetType } from './dto/review-target-type.enum';
import { UpdateReviewDto } from './dto/update-review.dto';

const reviewTargetSelect = Prisma.validator<Prisma.ReviewSelect>()({
  business: {
    select: {
      id: true,
      name: true,
      slug: true,
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

const myReviewSelect = Prisma.validator<Prisma.ReviewSelect>()({
  id: true,
  rating: true,
  title: true,
  body: true,
  status: true,
  moderationNote: true,
  moderatedAt: true,
  publishedAt: true,
  hiddenAt: true,
  rejectedAt: true,
  createdAt: true,
  updatedAt: true,
  ...reviewTargetSelect,
});

const publicReviewSelect = Prisma.validator<Prisma.ReviewSelect>()({
  id: true,
  rating: true,
  title: true,
  body: true,
  publishedAt: true,
  createdAt: true,
  author: {
    select: { profile: { select: { firstName: true, lastName: true } } },
  },
});

type MyReviewRecord = Prisma.ReviewGetPayload<{
  select: typeof myReviewSelect;
}>;
type PublicReviewRecord = Prisma.ReviewGetPayload<{
  select: typeof publicReviewSelect;
}>;
type ReviewCreateData = Pick<
  Prisma.ReviewUncheckedCreateInput,
  | 'userId'
  | 'businessId'
  | 'serviceId'
  | 'destinationId'
  | 'attractionId'
  | 'rating'
  | 'title'
  | 'body'
  | 'status'
>;

type TargetSummary =
  | {
      type: ReviewTargetType.BUSINESS;
      id: string;
      name: string;
      slug: string;
      category: { code: string; name: string };
      city: { name: string; slug: string };
      region: { name: string; slug: string };
      destination: { name: string; slug: string } | null;
    }
  | {
      type: ReviewTargetType.SERVICE;
      id: string;
      name: string;
      slug: string;
      shortDescription: string;
      category: { code: string; name: string };
      business: { name: string; slug: string };
      city: { name: string; slug: string };
      region: { name: string; slug: string };
      destination: { name: string; slug: string } | null;
    }
  | {
      type: ReviewTargetType.DESTINATION;
      id: string;
      name: string;
      slug: string;
      shortDescription: string;
      city: { name: string; slug: string };
      region: { name: string; slug: string };
    }
  | {
      type: ReviewTargetType.ATTRACTION;
      id: string;
      name: string;
      slug: string;
      category: string;
      destination: { name: string; slug: string };
      city: { name: string; slug: string };
      region: { name: string; slug: string };
    };

export interface MyReviewResponseDto {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  status: ReviewStatus;
  moderationNote: string | null;
  moderatedAt: Date | null;
  publishedAt: Date | null;
  hiddenAt: Date | null;
  rejectedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  target: TargetSummary;
}

export interface PublicReviewResponseDto {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  author: { displayName: string };
  publishedAt: Date | null;
  createdAt: Date;
}

export interface ReviewSummaryDto {
  averageRating: number | null;
  reviewCount: number;
  ratingDistribution: Record<'1' | '2' | '3' | '4' | '5', number>;
}

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    userId: string,
    dto: CreateReviewDto,
  ): Promise<MyReviewResponseDto> {
    await this.ensureActiveUser(userId);
    await this.ensureTargetIsPublic(dto.targetType, dto.targetId);
    try {
      const review = await this.prisma.review.create({
        data: this.createData(userId, dto),
        select: { id: true },
      });
      return this.findOwnedReview(userId, review.id);
    } catch (error) {
      this.throwDuplicateConflict(error);
      throw error;
    }
  }

  async findMine(
    userId: string,
    query: MyReviewQueryDto,
  ): Promise<PaginatedResponse<MyReviewResponseDto>> {
    await this.ensureActiveUser(userId);
    const where = this.ownedReviewWhere(userId, query.targetType, query.status);
    const [records, total] = await this.prisma.$transaction([
      this.prisma.review.findMany({
        where,
        select: myReviewSelect,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.review.count({ where }),
    ]);
    return paginate(
      records.map((record) => this.toMyResponse(record)),
      total,
      query.page,
      query.limit,
    );
  }

  async update(
    userId: string,
    reviewId: string,
    dto: UpdateReviewDto,
  ): Promise<MyReviewResponseDto> {
    await this.ensureActiveUser(userId);
    const data = this.updateData(dto);
    if (Object.keys(data).length === 0) {
      throw new BadRequestException(
        'At least one review field must be provided.',
      );
    }
    const result = await this.prisma.review.updateMany({
      where: { id: reviewId, userId },
      data: {
        ...data,
        status: ReviewStatus.PENDING,
        moderatedAt: null,
        moderatedById: null,
        moderationNote: null,
        publishedAt: null,
        hiddenAt: null,
        rejectedAt: null,
      },
    });
    if (result.count === 0) throw new NotFoundException('Review not found.');
    return this.findOwnedReview(userId, reviewId);
  }

  async findPublic(
    query: PublicReviewQueryDto,
  ): Promise<PaginatedResponse<PublicReviewResponseDto>> {
    await this.ensureTargetIsPublic(query.targetType, query.targetId);
    const where: Prisma.ReviewWhereInput = {
      ...this.targetWhere(query.targetType, query.targetId),
      status: ReviewStatus.PUBLISHED,
      rating: query.rating,
    };
    const [records, total] = await this.prisma.$transaction([
      this.prisma.review.findMany({
        where,
        select: publicReviewSelect,
        orderBy: this.publicOrderBy(query.sort),
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.review.count({ where }),
    ]);
    return paginate(
      records.map((record) => this.toPublicResponse(record)),
      total,
      query.page,
      query.limit,
    );
  }

  async summary(query: ReviewSummaryQueryDto): Promise<ReviewSummaryDto> {
    await this.ensureTargetIsPublic(query.targetType, query.targetId);
    const where: Prisma.ReviewWhereInput = {
      ...this.targetWhere(query.targetType, query.targetId),
      status: ReviewStatus.PUBLISHED,
    };
    const [aggregate, groupsResult] = await this.prisma.$transaction([
      this.prisma.review.aggregate({
        where,
        _avg: { rating: true },
        _count: { _all: true },
      }),
      this.prisma.review.groupBy({
        by: ['rating'],
        where,
        orderBy: { rating: 'asc' },
        _count: true,
      }),
    ]);
    const groups = groupsResult as unknown as Array<{
      rating: number;
      _count: number;
    }>;
    const ratingDistribution = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
    for (const group of groups) {
      const key = String(group.rating) as keyof typeof ratingDistribution;
      ratingDistribution[key] = group._count;
    }
    const average = aggregate._avg.rating;
    return {
      averageRating: average === null ? null : Math.round(average * 10) / 10,
      reviewCount: aggregate._count._all,
      ratingDistribution,
    };
  }

  private async ensureActiveUser(userId: string): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, status: UserStatus.ACTIVE },
      select: { id: true },
    });
    if (!user) throw new UnauthorizedException('Authentication required.');
  }

  private async ensureTargetIsPublic(
    targetType: ReviewTargetType,
    targetId: string,
  ): Promise<void> {
    if (!(await this.targetExists(targetType, targetId)))
      throw new NotFoundException('Review target not found.');
  }

  private async targetExists(
    targetType: ReviewTargetType,
    targetId: string,
  ): Promise<boolean> {
    switch (targetType) {
      case ReviewTargetType.BUSINESS:
        return Boolean(
          await this.prisma.business.findFirst({
            where: { id: targetId, ...publicBusinessWhere() },
            select: { id: true },
          }),
        );
      case ReviewTargetType.SERVICE:
        return Boolean(
          await this.prisma.service.findFirst({
            where: { id: targetId, ...publicServiceWhere() },
            select: { id: true },
          }),
        );
      case ReviewTargetType.DESTINATION:
        return Boolean(
          await this.prisma.destination.findFirst({
            where: { id: targetId, ...publicDestinationWhere() },
            select: { id: true },
          }),
        );
      case ReviewTargetType.ATTRACTION:
        return Boolean(
          await this.prisma.attraction.findFirst({
            where: { id: targetId, ...publicAttractionWhere() },
            select: { id: true },
          }),
        );
    }
  }

  private createData(userId: string, dto: CreateReviewDto): ReviewCreateData {
    return {
      ...this.targetWhere(dto.targetType, dto.targetId),
      userId,
      rating: dto.rating,
      title: dto.title,
      body: dto.body,
      status: ReviewStatus.PENDING,
    };
  }

  private updateData(
    dto: UpdateReviewDto,
  ): Prisma.ReviewUpdateManyMutationInput {
    const data: Prisma.ReviewUpdateManyMutationInput = {};
    if (dto.rating !== undefined) data.rating = dto.rating;
    if ('title' in dto) data.title = dto.title ?? null;
    if ('body' in dto) data.body = dto.body ?? null;
    return data;
  }

  private normalizeOptionalText(value: string | undefined): string | undefined {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
  }

  private ownedReviewWhere(
    userId: string,
    targetType?: ReviewTargetType,
    status?: ReviewStatus,
  ): Prisma.ReviewWhereInput {
    return {
      userId,
      status,
      ...(targetType ? this.targetPresentWhere(targetType) : {}),
    };
  }

  private targetPresentWhere(
    targetType: ReviewTargetType,
  ): Prisma.ReviewWhereInput {
    switch (targetType) {
      case ReviewTargetType.BUSINESS:
        return { businessId: { not: null } };
      case ReviewTargetType.SERVICE:
        return { serviceId: { not: null } };
      case ReviewTargetType.DESTINATION:
        return { destinationId: { not: null } };
      case ReviewTargetType.ATTRACTION:
        return { attractionId: { not: null } };
    }
  }

  private targetWhere(
    targetType: ReviewTargetType,
    targetId: string,
  ): Prisma.ReviewWhereInput & ReviewCreateTargetData {
    switch (targetType) {
      case ReviewTargetType.BUSINESS:
        return { businessId: targetId };
      case ReviewTargetType.SERVICE:
        return { serviceId: targetId };
      case ReviewTargetType.DESTINATION:
        return { destinationId: targetId };
      case ReviewTargetType.ATTRACTION:
        return { attractionId: targetId };
    }
  }

  private publicOrderBy(
    sort: PublicReviewSort,
  ): Prisma.ReviewOrderByWithRelationInput[] {
    switch (sort) {
      case PublicReviewSort.OLDEST:
        return [{ createdAt: 'asc' }];
      case PublicReviewSort.HIGHEST:
        return [{ rating: 'desc' }, { createdAt: 'desc' }];
      case PublicReviewSort.LOWEST:
        return [{ rating: 'asc' }, { createdAt: 'desc' }];
      case PublicReviewSort.NEWEST:
        return [{ createdAt: 'desc' }];
    }
  }

  private async findOwnedReview(
    userId: string,
    reviewId: string,
  ): Promise<MyReviewResponseDto> {
    const review = await this.prisma.review.findFirst({
      where: { id: reviewId, userId },
      select: myReviewSelect,
    });
    if (!review) throw new NotFoundException('Review not found.');
    return this.toMyResponse(review);
  }

  private toMyResponse(review: MyReviewRecord): MyReviewResponseDto {
    return {
      id: review.id,
      rating: review.rating,
      title: review.title,
      body: review.body,
      status: review.status,
      moderationNote: review.moderationNote,
      moderatedAt: review.moderatedAt,
      publishedAt: review.publishedAt,
      hiddenAt: review.hiddenAt,
      rejectedAt: review.rejectedAt,
      createdAt: review.createdAt,
      updatedAt: review.updatedAt,
      target: this.toTarget(review),
    };
  }

  private toPublicResponse(
    review: PublicReviewRecord,
  ): PublicReviewResponseDto {
    return {
      id: review.id,
      rating: review.rating,
      title: review.title,
      body: review.body,
      author: { displayName: this.authorDisplayName(review) },
      publishedAt: review.publishedAt,
      createdAt: review.createdAt,
    };
  }

  private authorDisplayName(review: PublicReviewRecord): string {
    const firstName = review.author.profile?.firstName?.trim();
    const lastName = review.author.profile?.lastName?.trim();
    return [firstName, lastName].filter(Boolean).join(' ') || 'Traveler';
  }

  private toTarget(review: MyReviewRecord): TargetSummary {
    if (review.business)
      return {
        type: ReviewTargetType.BUSINESS,
        id: review.business.id,
        name: review.business.name,
        slug: review.business.slug,
        category: review.business.category,
        city: {
          name: review.business.city.name,
          slug: review.business.city.slug,
        },
        region: review.business.city.region,
        destination: review.business.destination,
      };
    if (review.service)
      return {
        type: ReviewTargetType.SERVICE,
        id: review.service.id,
        name: review.service.name,
        slug: review.service.slug,
        shortDescription: review.service.shortDescription,
        category: review.service.category,
        business: {
          name: review.service.business.name,
          slug: review.service.business.slug,
        },
        city: {
          name: review.service.business.city.name,
          slug: review.service.business.city.slug,
        },
        region: review.service.business.city.region,
        destination: review.service.business.destination,
      };
    if (review.destination)
      return {
        type: ReviewTargetType.DESTINATION,
        id: review.destination.id,
        name: review.destination.name,
        slug: review.destination.slug,
        shortDescription: review.destination.shortDescription,
        city: {
          name: review.destination.city.name,
          slug: review.destination.city.slug,
        },
        region: review.destination.city.region,
      };
    if (review.attraction)
      return {
        type: ReviewTargetType.ATTRACTION,
        id: review.attraction.id,
        name: review.attraction.name,
        slug: review.attraction.slug,
        category: review.attraction.category,
        destination: {
          name: review.attraction.destination.name,
          slug: review.attraction.destination.slug,
        },
        city: {
          name: review.attraction.destination.city.name,
          slug: review.attraction.destination.city.slug,
        },
        region: review.attraction.destination.city.region,
      };
    throw new NotFoundException('Review target not found.');
  }

  private throwDuplicateConflict(error: unknown): void {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException('Review already exists for this target.');
    }
  }
}

type ReviewCreateTargetData = Pick<
  Prisma.ReviewUncheckedCreateInput,
  'businessId' | 'serviceId' | 'destinationId' | 'attractionId'
>;
