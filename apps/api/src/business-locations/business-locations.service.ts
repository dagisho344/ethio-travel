import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BusinessLocationStatus,
  BusinessMemberRole,
  BusinessWeekday,
  LocationStatus,
  Prisma,
  PublicationStatus,
} from '@prisma/client';
import { BusinessesService } from '../businesses/businesses.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateBusinessLocationDto,
  OperatingHourDto,
  ReplaceOperatingHoursDto,
  UpdateBusinessLocationDto,
} from './dto/business-location.dto';

export const businessLocationInclude = {
  city: { include: { region: true } },
  destination: true,
  operatingHours: { orderBy: { dayOfWeek: 'asc' } },
} satisfies Prisma.BusinessLocationInclude;

export type BusinessLocationRecord = Prisma.BusinessLocationGetPayload<{
  include: typeof businessLocationInclude;
}>;

type WriteTransaction = Prisma.TransactionClient;
const managingRoles = [BusinessMemberRole.OWNER, BusinessMemberRole.MANAGER];
const readRoles = [...managingRoles, BusinessMemberRole.STAFF];
const weekdays = Object.values(BusinessWeekday);

@Injectable()
export class BusinessLocationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly businesses: BusinessesService,
  ) {}

  async list(
    userId: string,
    businessId: string,
  ): Promise<BusinessLocationRecord[]> {
    await this.requireReadAccess(userId, businessId);
    return this.prisma.businessLocation.findMany({
      where: { businessId },
      include: businessLocationInclude,
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
    });
  }

  async findOne(
    userId: string,
    businessId: string,
    locationId: string,
  ): Promise<BusinessLocationRecord> {
    await this.requireReadAccess(userId, businessId);
    return this.findLocation(businessId, locationId);
  }

  async create(
    userId: string,
    businessId: string,
    dto: CreateBusinessLocationDto,
  ): Promise<BusinessLocationRecord> {
    await this.requireWriteAccess(userId, businessId);
    await this.validateLocation(dto.cityId, dto.destinationId, dto.timezone);
    const data = this.locationCreateData(dto);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const activeCount = await tx.businessLocation.count({
          where: { businessId, status: BusinessLocationStatus.ACTIVE },
        });
        const location = await tx.businessLocation.create({
          data: {
            businessId,
            ...data,
            isPrimary: activeCount === 0,
            status: BusinessLocationStatus.ACTIVE,
          },
          include: businessLocationInclude,
        });
        if (location.isPrimary) await this.syncLegacyPrimary(tx, location);
        return location;
      });
    } catch (error) {
      this.throwLabelConflict(error);
      throw error;
    }
  }

  async update(
    userId: string,
    businessId: string,
    locationId: string,
    dto: UpdateBusinessLocationDto,
  ): Promise<BusinessLocationRecord> {
    await this.requireWriteAccess(userId, businessId);
    const existing = await this.findLocation(businessId, locationId);
    this.assertMutable(existing);
    if (dto.status === BusinessLocationStatus.INACTIVE && existing.isPrimary) {
      throw new ConflictException(
        'Choose another active primary location before inactivating this location.',
      );
    }
    const cityId = dto.cityId ?? existing.cityId;
    const destinationId = this.resolvedDestinationId(dto, existing);
    await this.validateLocation(cityId, destinationId, dto.timezone);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const location = await tx.businessLocation.update({
          where: { id: existing.id },
          data: this.locationUpdateData(dto, destinationId),
          include: businessLocationInclude,
        });
        if (location.isPrimary) await this.syncLegacyPrimary(tx, location);
        return location;
      });
    } catch (error) {
      this.throwLabelConflict(error);
      throw error;
    }
  }

  async makePrimary(
    userId: string,
    businessId: string,
    locationId: string,
  ): Promise<BusinessLocationRecord> {
    await this.requireWriteAccess(userId, businessId);
    return this.prisma.$transaction(async (tx) => {
      const location = await tx.businessLocation.findFirst({
        where: { id: locationId, businessId },
        include: businessLocationInclude,
      });
      if (!location)
        throw new NotFoundException('Business location not found.');
      if (location.status !== BusinessLocationStatus.ACTIVE) {
        throw new ConflictException(
          'Only active locations can be the primary location.',
        );
      }
      await tx.businessLocation.updateMany({
        where: { businessId, isPrimary: true, id: { not: locationId } },
        data: { isPrimary: false },
      });
      const primary = await tx.businessLocation.update({
        where: { id: locationId },
        data: { isPrimary: true, status: BusinessLocationStatus.ACTIVE },
        include: businessLocationInclude,
      });
      await this.syncLegacyPrimary(tx, primary);
      return primary;
    });
  }

  async archive(
    userId: string,
    businessId: string,
    locationId: string,
  ): Promise<BusinessLocationRecord> {
    await this.requireWriteAccess(userId, businessId);
    return this.prisma.$transaction(async (tx) => {
      const location = await tx.businessLocation.findFirst({
        where: { id: locationId, businessId },
        include: businessLocationInclude,
      });
      if (!location)
        throw new NotFoundException('Business location not found.');
      this.assertMutable(location);
      if (location.isPrimary) {
        const otherActiveCount = await tx.businessLocation.count({
          where: {
            businessId,
            status: BusinessLocationStatus.ACTIVE,
            id: { not: locationId },
          },
        });
        if (otherActiveCount === 0) {
          throw new ConflictException(
            'A business must retain an active primary location.',
          );
        }
        throw new ConflictException(
          'Choose another primary location before archiving this location.',
        );
      }
      return tx.businessLocation.update({
        where: { id: locationId },
        data: {
          status: BusinessLocationStatus.ARCHIVED,
          archivedAt: new Date(),
        },
        include: businessLocationInclude,
      });
    });
  }

  async listHours(userId: string, businessId: string, locationId: string) {
    const location = await this.findOne(userId, businessId, locationId);
    return this.completeSchedule(location.operatingHours);
  }

  async replaceHours(
    userId: string,
    businessId: string,
    locationId: string,
    dto: ReplaceOperatingHoursDto,
  ) {
    await this.requireWriteAccess(userId, businessId);
    const location = await this.findLocation(businessId, locationId);
    this.assertMutable(location);
    const hours = this.validateSchedule(dto.hours);
    await this.prisma.$transaction(async (tx) => {
      await tx.businessLocationOperatingHour.deleteMany({
        where: { locationId },
      });
      await tx.businessLocationOperatingHour.createMany({
        data: hours.map((hour) => ({ locationId, ...hour })),
      });
    });
    return this.listHours(userId, businessId, locationId);
  }

  private async requireReadAccess(userId: string, businessId: string) {
    return this.businesses.requireMembership(userId, businessId, readRoles);
  }

  private async requireWriteAccess(userId: string, businessId: string) {
    return this.businesses.requireMembership(userId, businessId, managingRoles);
  }

  private async findLocation(
    businessId: string,
    locationId: string,
  ): Promise<BusinessLocationRecord> {
    const location = await this.prisma.businessLocation.findFirst({
      where: { id: locationId, businessId },
      include: businessLocationInclude,
    });
    if (!location) throw new NotFoundException('Business location not found.');
    return location;
  }

  private async validateLocation(
    cityId: string,
    destinationId: string | null | undefined,
    timezone: string | undefined,
  ): Promise<void> {
    const [city, destination] = await Promise.all([
      this.prisma.city.findFirst({
        where: { id: cityId, status: LocationStatus.ACTIVE },
      }),
      destinationId
        ? this.prisma.destination.findFirst({
            where: {
              id: destinationId,
              cityId,
              status: PublicationStatus.PUBLISHED,
            },
          })
        : Promise.resolve(null),
    ]);
    if (!city) throw new NotFoundException('Active city not found.');
    if (destinationId && !destination) {
      throw new BadRequestException(
        'Destination must be published and belong to the selected city.',
      );
    }
    if (timezone && !this.isValidTimezone(timezone)) {
      throw new BadRequestException('Timezone must be a valid IANA timezone.');
    }
  }

  private locationCreateData(dto: CreateBusinessLocationDto) {
    return {
      cityId: dto.cityId,
      destinationId: dto.destinationId ?? null,
      label: dto.label.trim(),
      addressLine1: dto.addressLine1.trim(),
      addressLine2: this.optionalText(dto.addressLine2),
      neighborhood: this.optionalText(dto.neighborhood),
      postalCode: this.optionalText(dto.postalCode),
      latitude: dto.latitude,
      longitude: dto.longitude,
      timezone: dto.timezone ?? 'Africa/Addis_Ababa',
    };
  }

  private locationUpdateData(
    dto: UpdateBusinessLocationDto,
    destinationId: string | null,
  ) {
    return {
      label: dto.label?.trim(),
      cityId: dto.cityId,
      destinationId,
      addressLine1: dto.addressLine1?.trim(),
      addressLine2:
        dto.addressLine2 === undefined
          ? undefined
          : this.optionalText(dto.addressLine2),
      neighborhood:
        dto.neighborhood === undefined
          ? undefined
          : this.optionalText(dto.neighborhood),
      postalCode:
        dto.postalCode === undefined
          ? undefined
          : this.optionalText(dto.postalCode),
      latitude: dto.latitude,
      longitude: dto.longitude,
      timezone: dto.timezone,
      status: dto.status,
    };
  }

  private resolvedDestinationId(
    dto: UpdateBusinessLocationDto,
    existing: BusinessLocationRecord,
  ): string | null {
    if (dto.destinationId !== undefined) return dto.destinationId ?? null;
    if (dto.cityId && dto.cityId !== existing.cityId) return null;
    return existing.destinationId;
  }

  private optionalText(value: string | null | undefined): string | null {
    const normalized = value?.trim();
    return normalized || null;
  }

  private assertMutable(location: BusinessLocationRecord): void {
    if (location.status === BusinessLocationStatus.ARCHIVED) {
      throw new ConflictException('Archived locations are read-only.');
    }
  }

  private validateSchedule(hours: OperatingHourDto[]) {
    if (hours.length !== weekdays.length) {
      throw new BadRequestException('Provide every weekday exactly once.');
    }
    const seen = new Set<BusinessWeekday>();
    return hours.map((hour) => {
      if (seen.has(hour.dayOfWeek)) {
        throw new BadRequestException('Each weekday may appear only once.');
      }
      seen.add(hour.dayOfWeek);
      const opensAt = hour.opensAt?.trim() || null;
      const closesAt = hour.closesAt?.trim() || null;
      if (hour.isClosed) {
        if (opensAt || closesAt) {
          throw new BadRequestException(
            'Closed days cannot have opening hours.',
          );
        }
        return {
          dayOfWeek: hour.dayOfWeek,
          isClosed: true,
          opensAt: null,
          closesAt: null,
        };
      }
      if (!opensAt || !closesAt || opensAt >= closesAt) {
        throw new BadRequestException(
          'Open days need a valid opening time before their closing time.',
        );
      }
      return { dayOfWeek: hour.dayOfWeek, isClosed: false, opensAt, closesAt };
    });
  }

  private completeSchedule(hours: BusinessLocationRecord['operatingHours']) {
    const byDay = new Map(hours.map((hour) => [hour.dayOfWeek, hour]));
    return weekdays.map(
      (dayOfWeek) =>
        byDay.get(dayOfWeek) ?? {
          dayOfWeek,
          isClosed: true,
          opensAt: null,
          closesAt: null,
        },
    );
  }

  private async syncLegacyPrimary(
    tx: WriteTransaction,
    location: BusinessLocationRecord,
  ): Promise<void> {
    await tx.business.update({
      where: { id: location.businessId },
      data: {
        cityId: location.cityId,
        destinationId: location.destinationId,
        addressLine1: location.addressLine1,
        addressLine2: location.addressLine2,
        neighborhood: location.neighborhood,
        postalCode: location.postalCode,
        latitude: location.latitude,
        longitude: location.longitude,
      },
    });
  }

  private isValidTimezone(timezone: string): boolean {
    try {
      Intl.DateTimeFormat('en-US', { timeZone: timezone });
      return true;
    } catch {
      return false;
    }
  }

  private throwLabelConflict(error: unknown): void {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException('A location with this label already exists.');
    }
  }
}
