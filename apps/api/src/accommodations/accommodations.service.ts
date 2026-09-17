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
import { ACCOMMODATION_SERVICE_CATEGORY_FAMILY } from './accommodation.constants';
import {
  CreateRoomTypeDto,
  UpdateAccommodationDetailDto,
  UpdateRoomTypeDto,
} from './dto/accommodation.dto';

const writableRoles = [BusinessMemberRole.OWNER, BusinessMemberRole.MANAGER];
const readableRoles = [...writableRoles, BusinessMemberRole.STAFF];

const accommodationServiceSelect = Prisma.validator<Prisma.ServiceSelect>()({
  id: true,
  name: true,
  status: true,
  category: { select: { code: true, family: true, name: true } },
  accommodationDetail: {
    select: {
      id: true,
      starClass: true,
      checkInTime: true,
      checkOutTime: true,
      roomTypes: {
        orderBy: [{ isActive: 'desc' }, { name: 'asc' }, { createdAt: 'asc' }],
        select: {
          id: true,
          name: true,
          description: true,
          capacity: true,
          basePrice: true,
          currency: true,
          quantity: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
  },
});

type AccommodationServiceRecord = Prisma.ServiceGetPayload<{
  select: typeof accommodationServiceSelect;
}>;
type RoomTypeRecord = NonNullable<
  AccommodationServiceRecord['accommodationDetail']
>['roomTypes'][number];
type AccommodationDetailValues = {
  starClass?: number | null;
  checkInTime?: string | null;
  checkOutTime?: string | null;
};

@Injectable()
export class AccommodationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly businesses: BusinessesService,
  ) {}

  async findMine(userId: string, businessId: string, serviceId: string) {
    await this.ensureActiveUser(userId);
    await this.businesses.requireMembership(userId, businessId, readableRoles);
    return this.toResponse(
      await this.findAccommodationService(businessId, serviceId),
    );
  }

  async updateDetail(
    userId: string,
    businessId: string,
    serviceId: string,
    dto: UpdateAccommodationDetailDto,
  ) {
    await this.ensureActiveUser(userId);
    await this.businesses.requireMembership(userId, businessId, writableRoles);
    const service = await this.findAccommodationService(businessId, serviceId);
    this.ensureServiceCanChange(service);
    const data = this.detailData(dto);
    await this.prisma.accommodationDetail.upsert({
      where: { serviceId: service.id },
      create: { service: { connect: { id: service.id } }, ...data },
      update: data,
    });
    return this.toResponse(
      await this.findAccommodationService(businessId, serviceId),
    );
  }

  async listRooms(userId: string, businessId: string, serviceId: string) {
    const response = await this.findMine(userId, businessId, serviceId);
    return response.roomTypes;
  }

  async createRoom(
    userId: string,
    businessId: string,
    serviceId: string,
    dto: CreateRoomTypeDto,
  ) {
    await this.ensureActiveUser(userId);
    await this.businesses.requireMembership(userId, businessId, writableRoles);
    const service = await this.findAccommodationService(businessId, serviceId);
    this.ensureServiceCanChange(service);
    const detail = service.accommodationDetail;
    if (!detail)
      throw new ConflictException(
        'Configure accommodation details before adding room types.',
      );
    const room = await this.prisma.roomType.create({
      data: {
        accommodationDetail: { connect: { id: detail.id } },
        name: dto.name,
        description: dto.description ?? null,
        capacity: dto.capacity,
        basePrice: new Prisma.Decimal(dto.basePrice),
        currency: dto.currency,
        quantity: dto.quantity,
      },
      select: this.roomSelect(),
    });
    return this.toRoom(room);
  }

  async updateRoom(
    userId: string,
    businessId: string,
    serviceId: string,
    roomTypeId: string,
    dto: UpdateRoomTypeDto,
  ) {
    await this.ensureActiveUser(userId);
    await this.businesses.requireMembership(userId, businessId, writableRoles);
    const service = await this.findAccommodationService(businessId, serviceId);
    this.ensureServiceCanChange(service);
    const room = await this.findRoomForService(roomTypeId, service.id);
    const updated = await this.prisma.roomType.update({
      where: { id: room.id },
      data: this.roomData(dto),
      select: this.roomSelect(),
    });
    return this.toRoom(updated);
  }

  async setRoomActive(
    userId: string,
    businessId: string,
    serviceId: string,
    roomTypeId: string,
    isActive: boolean,
  ) {
    await this.ensureActiveUser(userId);
    await this.businesses.requireMembership(userId, businessId, writableRoles);
    const service = await this.findAccommodationService(businessId, serviceId);
    this.ensureServiceCanChange(service);
    const room = await this.findRoomForService(roomTypeId, service.id);
    const updated = await this.prisma.roomType.update({
      where: { id: room.id },
      data: { isActive },
      select: this.roomSelect(),
    });
    return this.toRoom(updated);
  }

  private async findAccommodationService(
    businessId: string,
    serviceId: string,
  ): Promise<AccommodationServiceRecord> {
    const service = await this.prisma.service.findFirst({
      where: { id: serviceId, businessId },
      select: accommodationServiceSelect,
    });
    if (!service) throw new NotFoundException('Service not found.');
    if (service.category.family !== ACCOMMODATION_SERVICE_CATEGORY_FAMILY) {
      throw new ConflictException(
        'Accommodation configuration is only available for ACCOMMODATION services.',
      );
    }
    return service;
  }

  private async findRoomForService(roomTypeId: string, serviceId: string) {
    const room = await this.prisma.roomType.findFirst({
      where: { id: roomTypeId, accommodationDetail: { serviceId } },
      select: { id: true },
    });
    if (!room) throw new NotFoundException('Room type not found.');
    return room;
  }

  private ensureServiceCanChange(service: AccommodationServiceRecord): void {
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

  private detailData(
    dto: UpdateAccommodationDetailDto,
  ): AccommodationDetailValues {
    const data: AccommodationDetailValues = {};
    if (dto.starClass !== undefined) data.starClass = dto.starClass;
    if (dto.checkInTime !== undefined) data.checkInTime = dto.checkInTime;
    if (dto.checkOutTime !== undefined) data.checkOutTime = dto.checkOutTime;
    return data;
  }

  private roomData(dto: UpdateRoomTypeDto): Prisma.RoomTypeUpdateInput {
    const data: Prisma.RoomTypeUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.capacity !== undefined) data.capacity = dto.capacity;
    if (dto.basePrice !== undefined)
      data.basePrice = new Prisma.Decimal(dto.basePrice);
    if (dto.currency !== undefined) data.currency = dto.currency;
    if (dto.quantity !== undefined) data.quantity = dto.quantity;
    return data;
  }

  private roomSelect() {
    return {
      id: true,
      name: true,
      description: true,
      capacity: true,
      basePrice: true,
      currency: true,
      quantity: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    } satisfies Prisma.RoomTypeSelect;
  }

  private toResponse(service: AccommodationServiceRecord) {
    return {
      service: {
        id: service.id,
        name: service.name,
        status: service.status,
        category: service.category,
      },
      detail: service.accommodationDetail
        ? {
            id: service.accommodationDetail.id,
            starClass: service.accommodationDetail.starClass,
            checkInTime: service.accommodationDetail.checkInTime,
            checkOutTime: service.accommodationDetail.checkOutTime,
          }
        : null,
      roomTypes: service.accommodationDetail
        ? service.accommodationDetail.roomTypes.map((room) => this.toRoom(room))
        : [],
    };
  }

  private toRoom(room: RoomTypeRecord) {
    return {
      id: room.id,
      name: room.name,
      description: room.description,
      capacity: room.capacity,
      basePrice: room.basePrice.toString(),
      currency: room.currency,
      quantity: room.quantity,
      isActive: room.isActive,
      createdAt: room.createdAt,
      updatedAt: room.updatedAt,
    };
  }
}
