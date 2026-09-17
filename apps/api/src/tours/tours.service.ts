import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BusinessMemberRole,
  Prisma,
  ServiceStatus,
  UserStatus,
} from '@prisma/client';
import { BusinessesService } from '../businesses/businesses.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateTourItineraryItemDto,
  UpdateTourDetailDto,
  UpdateTourItineraryItemDto,
} from './dto/tour.dto';
import {
  MAX_TOUR_ITINERARY_ITEMS,
  TOUR_SERVICE_CATEGORY_FAMILY,
} from './tour.constants';

const writableRoles = [BusinessMemberRole.OWNER, BusinessMemberRole.MANAGER];
const readableRoles = [...writableRoles, BusinessMemberRole.STAFF];

const tourServiceSelect = Prisma.validator<Prisma.ServiceSelect>()({
  id: true,
  name: true,
  status: true,
  category: { select: { code: true, family: true, name: true } },
  tourDetail: {
    select: {
      id: true,
      durationDays: true,
      difficulty: true,
      meetingPoint: true,
      inclusions: true,
      exclusions: true,
      itineraryItems: {
        orderBy: [
          { dayNumber: 'asc' },
          { sortOrder: 'asc' },
          { createdAt: 'asc' },
        ],
        take: MAX_TOUR_ITINERARY_ITEMS,
        select: {
          id: true,
          dayNumber: true,
          title: true,
          description: true,
          sortOrder: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
  },
});

type TourServiceRecord = Prisma.ServiceGetPayload<{
  select: typeof tourServiceSelect;
}>;
type TourDetailRecord = NonNullable<TourServiceRecord['tourDetail']>;
type TourItineraryRecord = TourDetailRecord['itineraryItems'][number];
type TourDetailValues = {
  durationDays?: number;
  difficulty?: string;
  meetingPoint?: string;
  inclusions?: string[];
  exclusions?: string[];
};

@Injectable()
export class ToursService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly businesses: BusinessesService,
  ) {}

  async findMine(userId: string, businessId: string, serviceId: string) {
    await this.ensureActiveUser(userId);
    await this.businesses.requireMembership(userId, businessId, readableRoles);
    return this.toResponse(await this.findTourService(businessId, serviceId));
  }

  async updateDetail(
    userId: string,
    businessId: string,
    serviceId: string,
    dto: UpdateTourDetailDto,
  ) {
    await this.ensureActiveUser(userId);
    await this.businesses.requireMembership(userId, businessId, writableRoles);
    const service = await this.findTourService(businessId, serviceId);
    this.ensureServiceCanChange(service);
    if (dto.durationDays !== undefined && service.tourDetail) {
      await this.ensureDurationCoversItinerary(
        service.tourDetail.id,
        dto.durationDays,
      );
    }
    const data = this.detailData(dto);
    await this.prisma.tourDetail.upsert({
      where: { serviceId: service.id },
      create: { service: { connect: { id: service.id } }, ...data },
      update: data,
    });
    return this.toResponse(await this.findTourService(businessId, serviceId));
  }

  async listItinerary(userId: string, businessId: string, serviceId: string) {
    const response = await this.findMine(userId, businessId, serviceId);
    return response.itinerary;
  }

  async createItineraryItem(
    userId: string,
    businessId: string,
    serviceId: string,
    dto: CreateTourItineraryItemDto,
  ) {
    await this.ensureActiveUser(userId);
    await this.businesses.requireMembership(userId, businessId, writableRoles);
    const service = await this.findTourService(businessId, serviceId);
    this.ensureServiceCanChange(service);
    const detail = service.tourDetail;
    if (!detail) {
      throw new ConflictException(
        'Configure tour details before adding itinerary items.',
      );
    }
    this.ensureDayWithinDuration(dto.dayNumber, detail.durationDays);
    const itemCount = await this.prisma.tourItineraryItem.count({
      where: { tourDetailId: detail.id },
    });
    if (itemCount >= MAX_TOUR_ITINERARY_ITEMS) {
      throw new ConflictException(
        'Tour itinerary-item limit has been reached.',
      );
    }
    const item = await this.prisma.tourItineraryItem.create({
      data: {
        tourDetail: { connect: { id: detail.id } },
        dayNumber: dto.dayNumber,
        title: dto.title,
        description: dto.description ?? null,
        sortOrder: dto.sortOrder ?? 0,
      },
      select: this.itinerarySelect(),
    });
    return this.toItineraryItem(item);
  }

  async updateItineraryItem(
    userId: string,
    businessId: string,
    serviceId: string,
    itemId: string,
    dto: UpdateTourItineraryItemDto,
  ) {
    await this.ensureActiveUser(userId);
    await this.businesses.requireMembership(userId, businessId, writableRoles);
    const service = await this.findTourService(businessId, serviceId);
    this.ensureServiceCanChange(service);
    const detail = service.tourDetail;
    if (!detail) throw new NotFoundException('Tour details not found.');
    const item = await this.findItineraryItemForService(itemId, service.id);
    this.ensureDayWithinDuration(
      dto.dayNumber ?? item.dayNumber,
      detail.durationDays,
    );
    const updated = await this.prisma.tourItineraryItem.update({
      where: { id: item.id },
      data: this.itineraryData(dto),
      select: this.itinerarySelect(),
    });
    return this.toItineraryItem(updated);
  }

  private async findTourService(
    businessId: string,
    serviceId: string,
  ): Promise<TourServiceRecord> {
    const service = await this.prisma.service.findFirst({
      where: { id: serviceId, businessId },
      select: tourServiceSelect,
    });
    if (!service) throw new NotFoundException('Service not found.');
    if (service.category.family !== TOUR_SERVICE_CATEGORY_FAMILY) {
      throw new ConflictException(
        'Tour configuration is only available for TOUR services.',
      );
    }
    return service;
  }

  private async findItineraryItemForService(itemId: string, serviceId: string) {
    const item = await this.prisma.tourItineraryItem.findFirst({
      where: { id: itemId, tourDetail: { serviceId } },
      select: { id: true, dayNumber: true },
    });
    if (!item) throw new NotFoundException('Tour itinerary item not found.');
    return item;
  }

  private async ensureDurationCoversItinerary(
    tourDetailId: string,
    durationDays: number,
  ): Promise<void> {
    const lastItineraryItem = await this.prisma.tourItineraryItem.findFirst({
      where: { tourDetailId },
      orderBy: { dayNumber: 'desc' },
      select: { dayNumber: true },
    });
    if (lastItineraryItem && lastItineraryItem.dayNumber > durationDays) {
      throw new ConflictException(
        'Tour duration cannot be shorter than the final itinerary day.',
      );
    }
  }

  private ensureDayWithinDuration(
    dayNumber: number,
    durationDays: number | null,
  ): void {
    if (durationDays !== null && dayNumber > durationDays) {
      throw new ConflictException(
        'Itinerary day must be within the configured tour duration.',
      );
    }
  }

  private ensureServiceCanChange(service: TourServiceRecord): void {
    if (service.status === ServiceStatus.ARCHIVED) {
      throw new ConflictException('Archived services cannot be changed.');
    }
  }

  private async ensureActiveUser(userId: string): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, status: UserStatus.ACTIVE },
      select: { id: true },
    });
    if (!user) throw new ForbiddenException('Active user is required.');
  }

  private detailData(dto: UpdateTourDetailDto): TourDetailValues {
    const data: TourDetailValues = {};
    if (dto.durationDays !== undefined) data.durationDays = dto.durationDays;
    if (dto.difficulty !== undefined) data.difficulty = dto.difficulty;
    if (dto.meetingPoint !== undefined) data.meetingPoint = dto.meetingPoint;
    if (dto.inclusions !== undefined) {
      data.inclusions = this.normalizeLabels(dto.inclusions);
    }
    if (dto.exclusions !== undefined) {
      data.exclusions = this.normalizeLabels(dto.exclusions);
    }
    return data;
  }

  private normalizeLabels(values: string[]): string[] {
    const labels: string[] = [];
    const seen = new Set<string>();
    for (const value of values) {
      const trimmed = value.trim();
      const normalized = trimmed.toLocaleLowerCase();
      if (!seen.has(normalized)) {
        seen.add(normalized);
        labels.push(trimmed);
      }
    }
    return labels;
  }

  private itineraryData(
    dto: UpdateTourItineraryItemDto,
  ): Prisma.TourItineraryItemUpdateInput {
    const data: Prisma.TourItineraryItemUpdateInput = {};
    if (dto.dayNumber !== undefined) data.dayNumber = dto.dayNumber;
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;
    return data;
  }

  private itinerarySelect() {
    return {
      id: true,
      dayNumber: true,
      title: true,
      description: true,
      sortOrder: true,
      createdAt: true,
      updatedAt: true,
    } satisfies Prisma.TourItineraryItemSelect;
  }

  private toResponse(service: TourServiceRecord) {
    return {
      service: {
        id: service.id,
        name: service.name,
        status: service.status,
        category: service.category,
      },
      detail: service.tourDetail
        ? {
            id: service.tourDetail.id,
            durationDays: service.tourDetail.durationDays,
            difficulty: service.tourDetail.difficulty,
            meetingPoint: service.tourDetail.meetingPoint,
            inclusions: service.tourDetail.inclusions,
            exclusions: service.tourDetail.exclusions,
          }
        : null,
      itinerary: service.tourDetail
        ? service.tourDetail.itineraryItems.map((item) =>
            this.toItineraryItem(item),
          )
        : [],
    };
  }

  private toItineraryItem(item: TourItineraryRecord) {
    return {
      id: item.id,
      dayNumber: item.dayNumber,
      title: item.title,
      description: item.description,
      sortOrder: item.sortOrder,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }
}
