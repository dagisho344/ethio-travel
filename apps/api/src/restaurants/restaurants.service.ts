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
  MAX_RESTAURANT_MENU_ITEMS,
  MAX_RESTAURANT_MENUS,
  RESTAURANT_SERVICE_CATEGORY_FAMILY,
} from './restaurant.constants';
import {
  CreateRestaurantMenuDto,
  CreateRestaurantMenuItemDto,
  UpdateRestaurantDetailDto,
  UpdateRestaurantMenuDto,
  UpdateRestaurantMenuItemDto,
} from './dto/restaurant.dto';

const writableRoles = [BusinessMemberRole.OWNER, BusinessMemberRole.MANAGER];
const readableRoles = [...writableRoles, BusinessMemberRole.STAFF];

const restaurantServiceSelect = Prisma.validator<Prisma.ServiceSelect>()({
  id: true,
  name: true,
  status: true,
  category: { select: { code: true, family: true, name: true } },
  restaurantDetail: {
    select: {
      id: true,
      cuisineTypes: true,
      reservationSupported: true,
      deliverySupported: true,
      menus: {
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        take: MAX_RESTAURANT_MENUS,
        select: {
          id: true,
          name: true,
          description: true,
          isActive: true,
          sortOrder: true,
          createdAt: true,
          updatedAt: true,
          items: {
            orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
            take: MAX_RESTAURANT_MENU_ITEMS,
            select: {
              id: true,
              section: true,
              name: true,
              description: true,
              price: true,
              currency: true,
              available: true,
              sortOrder: true,
              createdAt: true,
              updatedAt: true,
            },
          },
        },
      },
    },
  },
});

type RestaurantServiceRecord = Prisma.ServiceGetPayload<{
  select: typeof restaurantServiceSelect;
}>;
type RestaurantDetailRecord = NonNullable<
  RestaurantServiceRecord['restaurantDetail']
>;
type RestaurantMenuRecord = RestaurantDetailRecord['menus'][number];
type RestaurantMenuItemRecord = RestaurantMenuRecord['items'][number];
type RestaurantDetailValues = {
  cuisineTypes?: string[];
  reservationSupported?: boolean;
  deliverySupported?: boolean;
};

@Injectable()
export class RestaurantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly businesses: BusinessesService,
  ) {}

  async findMine(userId: string, businessId: string, serviceId: string) {
    await this.ensureActiveUser(userId);
    await this.businesses.requireMembership(userId, businessId, readableRoles);
    return this.toResponse(
      await this.findRestaurantService(businessId, serviceId),
    );
  }

  async updateDetail(
    userId: string,
    businessId: string,
    serviceId: string,
    dto: UpdateRestaurantDetailDto,
  ) {
    await this.ensureActiveUser(userId);
    await this.businesses.requireMembership(userId, businessId, writableRoles);
    const service = await this.findRestaurantService(businessId, serviceId);
    this.ensureServiceCanChange(service);
    const data = this.detailData(dto);
    await this.prisma.restaurantDetail.upsert({
      where: { serviceId: service.id },
      create: { service: { connect: { id: service.id } }, ...data },
      update: data,
    });
    return this.toResponse(
      await this.findRestaurantService(businessId, serviceId),
    );
  }

  async listMenus(userId: string, businessId: string, serviceId: string) {
    const response = await this.findMine(userId, businessId, serviceId);
    return response.menus;
  }

  async createMenu(
    userId: string,
    businessId: string,
    serviceId: string,
    dto: CreateRestaurantMenuDto,
  ) {
    await this.ensureActiveUser(userId);
    await this.businesses.requireMembership(userId, businessId, writableRoles);
    const service = await this.findRestaurantService(businessId, serviceId);
    this.ensureServiceCanChange(service);
    const detail = service.restaurantDetail;
    if (!detail) {
      throw new ConflictException(
        'Configure restaurant details before adding menus.',
      );
    }
    const menuCount = await this.prisma.restaurantMenu.count({
      where: { restaurantDetailId: detail.id },
    });
    if (menuCount >= MAX_RESTAURANT_MENUS) {
      throw new ConflictException('Restaurant menu limit has been reached.');
    }
    const menu = await this.prisma.restaurantMenu.create({
      data: {
        restaurantDetail: { connect: { id: detail.id } },
        name: dto.name,
        description: dto.description ?? null,
        sortOrder: dto.sortOrder ?? 0,
      },
      select: this.menuSelect(),
    });
    return this.toMenu(menu);
  }

  async updateMenu(
    userId: string,
    businessId: string,
    serviceId: string,
    menuId: string,
    dto: UpdateRestaurantMenuDto,
  ) {
    await this.ensureActiveUser(userId);
    await this.businesses.requireMembership(userId, businessId, writableRoles);
    const service = await this.findRestaurantService(businessId, serviceId);
    this.ensureServiceCanChange(service);
    const menu = await this.findMenuForService(menuId, service.id);
    const updated = await this.prisma.restaurantMenu.update({
      where: { id: menu.id },
      data: this.menuData(dto),
      select: this.menuSelect(),
    });
    return this.toMenu(updated);
  }

  async setMenuActive(
    userId: string,
    businessId: string,
    serviceId: string,
    menuId: string,
    isActive: boolean,
  ) {
    await this.ensureActiveUser(userId);
    await this.businesses.requireMembership(userId, businessId, writableRoles);
    const service = await this.findRestaurantService(businessId, serviceId);
    this.ensureServiceCanChange(service);
    const menu = await this.findMenuForService(menuId, service.id);
    const updated = await this.prisma.restaurantMenu.update({
      where: { id: menu.id },
      data: { isActive },
      select: this.menuSelect(),
    });
    return this.toMenu(updated);
  }

  async listMenuItems(
    userId: string,
    businessId: string,
    serviceId: string,
    menuId: string,
  ) {
    await this.ensureActiveUser(userId);
    await this.businesses.requireMembership(userId, businessId, readableRoles);
    const service = await this.findRestaurantService(businessId, serviceId);
    const menu = await this.findMenuForService(menuId, service.id);
    const result = await this.prisma.restaurantMenu.findUnique({
      where: { id: menu.id },
      select: {
        items: {
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
          select: this.menuItemSelect(),
        },
      },
    });
    return result?.items.map((item) => this.toMenuItem(item)) ?? [];
  }

  async createMenuItem(
    userId: string,
    businessId: string,
    serviceId: string,
    menuId: string,
    dto: CreateRestaurantMenuItemDto,
  ) {
    await this.ensureActiveUser(userId);
    await this.businesses.requireMembership(userId, businessId, writableRoles);
    const service = await this.findRestaurantService(businessId, serviceId);
    this.ensureServiceCanChange(service);
    const menu = await this.findMenuForService(menuId, service.id);
    const itemCount = await this.prisma.restaurantMenuItem.count({
      where: { menuId: menu.id },
    });
    if (itemCount >= MAX_RESTAURANT_MENU_ITEMS) {
      throw new ConflictException(
        'Restaurant menu-item limit has been reached.',
      );
    }
    const item = await this.prisma.restaurantMenuItem.create({
      data: {
        menu: { connect: { id: menu.id } },
        section: dto.section ?? null,
        name: dto.name,
        description: dto.description ?? null,
        price: new Prisma.Decimal(dto.price),
        currency: dto.currency,
        sortOrder: dto.sortOrder ?? 0,
      },
      select: this.menuItemSelect(),
    });
    return this.toMenuItem(item);
  }

  async updateMenuItem(
    userId: string,
    businessId: string,
    serviceId: string,
    menuId: string,
    itemId: string,
    dto: UpdateRestaurantMenuItemDto,
  ) {
    await this.ensureActiveUser(userId);
    await this.businesses.requireMembership(userId, businessId, writableRoles);
    const service = await this.findRestaurantService(businessId, serviceId);
    this.ensureServiceCanChange(service);
    const menu = await this.findMenuForService(menuId, service.id);
    const item = await this.findMenuItemForMenu(itemId, menu.id, service.id);
    const updated = await this.prisma.restaurantMenuItem.update({
      where: { id: item.id },
      data: this.menuItemData(dto),
      select: this.menuItemSelect(),
    });
    return this.toMenuItem(updated);
  }

  async setMenuItemAvailable(
    userId: string,
    businessId: string,
    serviceId: string,
    menuId: string,
    itemId: string,
    available: boolean,
  ) {
    await this.ensureActiveUser(userId);
    await this.businesses.requireMembership(userId, businessId, writableRoles);
    const service = await this.findRestaurantService(businessId, serviceId);
    this.ensureServiceCanChange(service);
    const menu = await this.findMenuForService(menuId, service.id);
    const item = await this.findMenuItemForMenu(itemId, menu.id, service.id);
    const updated = await this.prisma.restaurantMenuItem.update({
      where: { id: item.id },
      data: { available },
      select: this.menuItemSelect(),
    });
    return this.toMenuItem(updated);
  }

  private async findRestaurantService(
    businessId: string,
    serviceId: string,
  ): Promise<RestaurantServiceRecord> {
    const service = await this.prisma.service.findFirst({
      where: { id: serviceId, businessId },
      select: restaurantServiceSelect,
    });
    if (!service) throw new NotFoundException('Service not found.');
    if (service.category.family !== RESTAURANT_SERVICE_CATEGORY_FAMILY) {
      throw new ConflictException(
        'Restaurant configuration is only available for RESTAURANT services.',
      );
    }
    return service;
  }

  private async findMenuForService(menuId: string, serviceId: string) {
    const menu = await this.prisma.restaurantMenu.findFirst({
      where: { id: menuId, restaurantDetail: { serviceId } },
      select: { id: true },
    });
    if (!menu) throw new NotFoundException('Restaurant menu not found.');
    return menu;
  }

  private async findMenuItemForMenu(
    itemId: string,
    menuId: string,
    serviceId: string,
  ) {
    const item = await this.prisma.restaurantMenuItem.findFirst({
      where: {
        id: itemId,
        menuId,
        menu: { restaurantDetail: { serviceId } },
      },
      select: { id: true },
    });
    if (!item) throw new NotFoundException('Restaurant menu item not found.');
    return item;
  }

  private ensureServiceCanChange(service: RestaurantServiceRecord): void {
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

  private detailData(dto: UpdateRestaurantDetailDto): RestaurantDetailValues {
    const data: RestaurantDetailValues = {};
    if (dto.cuisineTypes !== undefined) {
      const cuisineTypes: string[] = [];
      const seen = new Set<string>();
      for (const cuisine of dto.cuisineTypes) {
        const trimmed = cuisine.trim();
        const normalized = trimmed.toLocaleLowerCase();
        if (!seen.has(normalized)) {
          seen.add(normalized);
          cuisineTypes.push(trimmed);
        }
      }
      data.cuisineTypes = cuisineTypes;
    }
    if (dto.reservationSupported !== undefined) {
      data.reservationSupported = dto.reservationSupported;
    }
    if (dto.deliverySupported !== undefined) {
      data.deliverySupported = dto.deliverySupported;
    }
    return data;
  }

  private menuData(
    dto: UpdateRestaurantMenuDto,
  ): Prisma.RestaurantMenuUpdateInput {
    const data: Prisma.RestaurantMenuUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;
    return data;
  }

  private menuItemData(
    dto: UpdateRestaurantMenuItemDto,
  ): Prisma.RestaurantMenuItemUpdateInput {
    const data: Prisma.RestaurantMenuItemUpdateInput = {};
    if (dto.section !== undefined) data.section = dto.section;
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.price !== undefined) data.price = new Prisma.Decimal(dto.price);
    if (dto.currency !== undefined) data.currency = dto.currency;
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;
    return data;
  }

  private menuSelect() {
    return {
      id: true,
      name: true,
      description: true,
      isActive: true,
      sortOrder: true,
      createdAt: true,
      updatedAt: true,
      items: {
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        take: MAX_RESTAURANT_MENU_ITEMS,
        select: this.menuItemSelect(),
      },
    } satisfies Prisma.RestaurantMenuSelect;
  }

  private menuItemSelect() {
    return {
      id: true,
      section: true,
      name: true,
      description: true,
      price: true,
      currency: true,
      available: true,
      sortOrder: true,
      createdAt: true,
      updatedAt: true,
    } satisfies Prisma.RestaurantMenuItemSelect;
  }

  private toResponse(service: RestaurantServiceRecord) {
    return {
      service: {
        id: service.id,
        name: service.name,
        status: service.status,
        category: service.category,
      },
      detail: service.restaurantDetail
        ? {
            id: service.restaurantDetail.id,
            cuisineTypes: service.restaurantDetail.cuisineTypes,
            reservationSupported: service.restaurantDetail.reservationSupported,
            deliverySupported: service.restaurantDetail.deliverySupported,
          }
        : null,
      menus: service.restaurantDetail
        ? service.restaurantDetail.menus.map((menu) => this.toMenu(menu))
        : [],
    };
  }

  private toMenu(menu: RestaurantMenuRecord) {
    return {
      id: menu.id,
      name: menu.name,
      description: menu.description,
      isActive: menu.isActive,
      sortOrder: menu.sortOrder,
      createdAt: menu.createdAt,
      updatedAt: menu.updatedAt,
      items: menu.items.map((item) => this.toMenuItem(item)),
    };
  }

  private toMenuItem(item: RestaurantMenuItemRecord) {
    return {
      id: item.id,
      section: item.section,
      name: item.name,
      description: item.description,
      price: item.price.toString(),
      currency: item.currency,
      available: item.available,
      sortOrder: item.sortOrder,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }
}
