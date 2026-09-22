import {
  BusinessMemberRole,
  BusinessMemberStatus,
  Prisma,
  ServiceCategoryFamily,
  ServiceStatus,
} from '@prisma/client';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { BusinessesService } from './businesses/businesses.service';
import { PrismaService } from './prisma/prisma.service';
import {
  MAX_RESTAURANT_MENU_ITEMS,
  MAX_RESTAURANT_MENUS,
} from './restaurants/restaurant.constants';
import { RestaurantsService } from './restaurants/restaurants.service';

const userId = '11111111-1111-4111-8111-111111111111';
const businessId = '22222222-2222-4222-8222-222222222222';
const serviceId = '33333333-3333-4333-8333-333333333333';
const menuId = '44444444-4444-4444-8444-444444444444';
const itemId = '55555555-5555-4555-8555-555555555555';
const detailId = '66666666-6666-4666-8666-666666666666';
const createdAt = new Date('2026-09-17T10:00:00.000Z');

function itemRecord() {
  return {
    id: itemId,
    section: 'Mains',
    name: 'Kocho',
    description: 'Traditional preparation.',
    price: new Prisma.Decimal('250.00'),
    currency: 'ETB',
    available: true,
    sortOrder: 0,
    createdAt,
    updatedAt: createdAt,
  };
}

function menuRecord() {
  return {
    id: menuId,
    name: 'Main menu',
    description: 'Local dishes.',
    isActive: true,
    sortOrder: 0,
    createdAt,
    updatedAt: createdAt,
    items: [itemRecord()],
  };
}

function serviceRecord(options?: {
  categoryCode?: string;
  categoryFamily?: ServiceCategoryFamily;
  categoryName?: string;
  detail?: boolean;
  status?: ServiceStatus;
}) {
  return {
    id: serviceId,
    name: 'Wolaita Kitchen',
    status: options?.status ?? ServiceStatus.DRAFT,
    category: {
      code: options?.categoryCode ?? 'MEAL',
      family: options?.categoryFamily ?? ServiceCategoryFamily.RESTAURANT,
      name: options?.categoryName ?? 'Meal',
    },
    restaurantDetail:
      options?.detail === false
        ? null
        : {
            id: detailId,
            cuisineTypes: ['Ethiopian'],
            reservationSupported: true,
            deliverySupported: false,
            menus: [menuRecord()],
          },
  };
}

function fixture(record = serviceRecord()) {
  const requireMembership = jest
    .fn()
    .mockResolvedValue({ role: BusinessMemberRole.OWNER });
  const detailUpsert = jest.fn().mockResolvedValue({});
  const menuFindFirst = jest.fn().mockResolvedValue({ id: menuId });
  const menuCount = jest.fn().mockResolvedValue(0);
  const menuCreate = jest.fn().mockResolvedValue(menuRecord());
  const menuUpdate = jest.fn().mockResolvedValue(menuRecord());
  const menuFindUnique = jest.fn().mockResolvedValue({ items: [itemRecord()] });
  const itemFindFirst = jest.fn().mockResolvedValue({ id: itemId });
  const itemCount = jest.fn().mockResolvedValue(0);
  const itemCreate = jest.fn().mockResolvedValue(itemRecord());
  const itemUpdate = jest.fn().mockResolvedValue(itemRecord());
  const userFindFirst = jest.fn().mockResolvedValue({ id: userId });
  const serviceFindFirst = jest.fn().mockResolvedValue(record);
  const prisma = {
    user: { findFirst: userFindFirst },
    service: { findFirst: serviceFindFirst },
    restaurantDetail: { upsert: detailUpsert },
    restaurantMenu: {
      count: menuCount,
      findFirst: menuFindFirst,
      findUnique: menuFindUnique,
      create: menuCreate,
      update: menuUpdate,
    },
    restaurantMenuItem: {
      count: itemCount,
      findFirst: itemFindFirst,
      create: itemCreate,
      update: itemUpdate,
    },
  } as unknown as PrismaService;
  const businesses = { requireMembership } as unknown as BusinessesService;
  return {
    prisma,
    restaurants: new RestaurantsService(prisma, businesses),
    requireMembership,
    detailUpsert,
    menuCount,
    menuFindFirst,
    menuCreate,
    menuUpdate,
    itemCount,
    itemFindFirst,
    itemCreate,
    itemUpdate,
    serviceFindFirst,
    userFindFirst,
  };
}

describe('Phase 14C restaurant service', () => {
  it('allows active staff to read an owned RESTAURANT-family service', async () => {
    const { restaurants, requireMembership } = fixture();
    requireMembership.mockResolvedValue({ role: BusinessMemberRole.STAFF });

    await expect(
      restaurants.findMine(userId, businessId, serviceId),
    ).resolves.toMatchObject({
      service: { id: serviceId, category: { code: 'MEAL' } },
      detail: { cuisineTypes: ['Ethiopian'] },
      menus: [expect.objectContaining({ id: menuId })],
    });
    expect(requireMembership).toHaveBeenCalledWith(userId, businessId, [
      BusinessMemberRole.OWNER,
      BusinessMemberRole.MANAGER,
      BusinessMemberRole.STAFF,
    ]);
  });

  it('requires owner or manager membership for detail, menu, and item mutations', async () => {
    const {
      restaurants,
      requireMembership,
      detailUpsert,
      menuCreate,
      itemCreate,
    } = fixture();

    await restaurants.updateDetail(userId, businessId, serviceId, {
      cuisineTypes: ['Ethiopian', 'ethiopian', 'Wolaita'],
      reservationSupported: true,
      deliverySupported: true,
    });
    await restaurants.createMenu(userId, businessId, serviceId, {
      name: 'Breakfast',
      sortOrder: 1,
    });
    await restaurants.createMenuItem(userId, businessId, serviceId, menuId, {
      name: 'Buna',
      price: '50.00',
      currency: 'ETB',
      sortOrder: 2,
    });

    expect(requireMembership).toHaveBeenCalledWith(userId, businessId, [
      BusinessMemberRole.OWNER,
      BusinessMemberRole.MANAGER,
    ]);
    expect(detailUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          cuisineTypes: ['Ethiopian', 'Wolaita'],
          reservationSupported: true,
          deliverySupported: true,
        }) as unknown,
      }),
    );
    expect(menuCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ sortOrder: 1 }) as unknown,
      }),
    );
    expect(itemCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          currency: 'ETB',
          price: expect.any(Prisma.Decimal) as unknown,
        }) as unknown,
      }),
    );
  });

  it('honors active membership denial before restaurant writes', async () => {
    const { restaurants, detailUpsert, requireMembership } = fixture();
    requireMembership.mockRejectedValue(
      new ForbiddenException('Business membership is required.'),
    );

    await expect(
      restaurants.updateDetail(userId, businessId, serviceId, {
        cuisineTypes: ['Ethiopian'],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(detailUpsert).not.toHaveBeenCalled();
  });

  it('accepts a future restaurant category code through its stable family', async () => {
    const { restaurants } = fixture(
      serviceRecord({
        categoryCode: 'RESTAURANT_SPECIAL',
        categoryFamily: ServiceCategoryFamily.RESTAURANT,
        categoryName: 'Not used for compatibility',
      }),
    );

    await expect(
      restaurants.findMine(userId, businessId, serviceId),
    ).resolves.toMatchObject({
      service: { category: { code: 'RESTAURANT_SPECIAL' } },
    });
  });

  it.each([
    ['ROOM', ServiceCategoryFamily.ACCOMMODATION],
    ['TOUR', ServiceCategoryFamily.TOUR],
    ['TRANSFER', ServiceCategoryFamily.TRANSPORT],
    ['GENERAL', ServiceCategoryFamily.OTHER],
  ])('rejects %s outside the RESTAURANT family', async (code, family) => {
    const { restaurants, detailUpsert } = fixture(
      serviceRecord({ categoryCode: code, categoryFamily: family }),
    );

    await expect(
      restaurants.updateDetail(userId, businessId, serviceId, {
        cuisineTypes: ['Ethiopian'],
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(detailUpsert).not.toHaveBeenCalled();
  });

  it('requires details before creating menus and preserves menu history through lifecycle commands', async () => {
    const withoutDetail = fixture(serviceRecord({ detail: false }));
    await expect(
      withoutDetail.restaurants.createMenu(userId, businessId, serviceId, {
        name: 'Breakfast',
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    const withDetail = fixture();
    await withDetail.restaurants.setMenuActive(
      userId,
      businessId,
      serviceId,
      menuId,
      false,
    );
    expect(withDetail.menuUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { isActive: false } }),
    );
  });

  it('does not allow a cross-business menu or menu item UUID to be mutated', async () => {
    const {
      restaurants,
      menuFindFirst,
      menuUpdate,
      itemFindFirst,
      itemUpdate,
    } = fixture();
    menuFindFirst.mockResolvedValue(null);

    await expect(
      restaurants.updateMenu(userId, businessId, serviceId, menuId, {
        name: 'Changed',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(menuUpdate).not.toHaveBeenCalled();

    menuFindFirst.mockResolvedValue({ id: menuId });
    itemFindFirst.mockResolvedValue(null);
    await expect(
      restaurants.updateMenuItem(
        userId,
        businessId,
        serviceId,
        menuId,
        itemId,
        {
          name: 'Changed',
        },
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(itemUpdate).not.toHaveBeenCalled();
  });

  it('preserves menu-item rows through availability lifecycle commands', async () => {
    const { restaurants, itemUpdate } = fixture();

    await restaurants.setMenuItemAvailable(
      userId,
      businessId,
      serviceId,
      menuId,
      itemId,
      false,
    );
    expect(itemUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { available: false } }),
    );
  });

  it('does not mutate restaurant content for archived services', async () => {
    const { restaurants } = fixture(
      serviceRecord({ status: ServiceStatus.ARCHIVED }),
    );

    await expect(
      restaurants.updateDetail(userId, businessId, serviceId, {
        cuisineTypes: ['Ethiopian'],
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
  it('allows an active manager to write restaurant details', async () => {
    const { restaurants, requireMembership, detailUpsert } = fixture();
    requireMembership.mockResolvedValue({ role: BusinessMemberRole.MANAGER });

    await restaurants.updateDetail(userId, businessId, serviceId, {
      cuisineTypes: ['Gurage'],
    });

    expect(detailUpsert).toHaveBeenCalled();
    expect(requireMembership).toHaveBeenCalledWith(userId, businessId, [
      BusinessMemberRole.OWNER,
      BusinessMemberRole.MANAGER,
    ]);
  });

  it('denies an inactive user before membership or restaurant data access', async () => {
    const { restaurants, requireMembership, userFindFirst } = fixture();
    userFindFirst.mockResolvedValue(null);

    await expect(
      restaurants.findMine(userId, businessId, serviceId),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(requireMembership).not.toHaveBeenCalled();
  });

  it('denies a traveler or other non-member through the authoritative membership check', async () => {
    const { restaurants, requireMembership } = fixture();
    requireMembership.mockRejectedValue(
      new ForbiddenException('Business membership is required.'),
    );

    await expect(
      restaurants.findMine(userId, businessId, serviceId),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('does not expose a different business restaurant detail by service UUID', async () => {
    const { restaurants, detailUpsert, serviceFindFirst } = fixture();
    serviceFindFirst.mockResolvedValue(null);

    await expect(
      restaurants.updateDetail(userId, businessId, serviceId, {
        cuisineTypes: ['Oromo'],
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(detailUpsert).not.toHaveBeenCalled();
  });
  it('trims cuisines and preserves the first spelling during case-insensitive deduplication', async () => {
    const { restaurants, detailUpsert } = fixture();

    await restaurants.updateDetail(userId, businessId, serviceId, {
      cuisineTypes: [' Ethiopian ', 'ethiopian', 'Wolaita '],
    });

    expect(detailUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          cuisineTypes: ['Ethiopian', 'Wolaita'],
        }) as unknown,
      }),
    );
  });

  it('denies STAFF restaurant detail, menu, and menu-item writes while preserving read access', async () => {
    const {
      restaurants,
      requireMembership,
      detailUpsert,
      menuCreate,
      itemCreate,
    } = fixture();
    requireMembership.mockImplementation(
      (
        _requestedUserId: string,
        _requestedBusinessId: string,
        roles: BusinessMemberRole[],
      ) =>
        roles.includes(BusinessMemberRole.STAFF)
          ? Promise.resolve({ role: BusinessMemberRole.STAFF })
          : Promise.reject(
              new ForbiddenException('Business membership is required.'),
            ),
    );

    await expect(
      restaurants.findMine(userId, businessId, serviceId),
    ).resolves.toBeDefined();
    await expect(
      restaurants.updateDetail(userId, businessId, serviceId, {
        cuisineTypes: ['Ethiopian'],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      restaurants.createMenu(userId, businessId, serviceId, { name: 'Lunch' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      restaurants.createMenuItem(userId, businessId, serviceId, menuId, {
        name: 'Kocho',
        price: '10.00',
        currency: 'ETB',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(detailUpsert).not.toHaveBeenCalled();
    expect(menuCreate).not.toHaveBeenCalled();
    expect(itemCreate).not.toHaveBeenCalled();
  });

  it('denies an inactive membership through BusinessesService active-membership filtering', async () => {
    const restaurantFixture = fixture();
    const membershipFindFirst = jest.fn().mockResolvedValue(null);
    const membershipPrisma = {
      businessMember: { findFirst: membershipFindFirst },
    } as unknown as PrismaService;
    const restaurants = new RestaurantsService(
      restaurantFixture.prisma,
      new BusinessesService(membershipPrisma),
    );

    await expect(
      restaurants.updateDetail(userId, businessId, serviceId, {
        cuisineTypes: ['Ethiopian'],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(membershipFindFirst).toHaveBeenCalledWith({
      where: {
        businessId,
        userId,
        status: BusinessMemberStatus.ACTIVE,
        role: {
          in: [BusinessMemberRole.OWNER, BusinessMemberRole.MANAGER],
        },
      },
    });
  });

  it('does not permit cross-business lifecycle actions using a menu or item UUID', async () => {
    const {
      restaurants,
      menuFindFirst,
      menuUpdate,
      itemFindFirst,
      itemUpdate,
    } = fixture();
    menuFindFirst.mockResolvedValue(null);

    await expect(
      restaurants.setMenuActive(userId, businessId, serviceId, menuId, false),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(menuUpdate).not.toHaveBeenCalled();

    menuFindFirst.mockResolvedValue({ id: menuId });
    itemFindFirst.mockResolvedValue(null);
    await expect(
      restaurants.setMenuItemAvailable(
        userId,
        businessId,
        serviceId,
        menuId,
        itemId,
        false,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(itemUpdate).not.toHaveBeenCalled();
  });

  it('preserves menu and item identities and child rows across explicit lifecycle actions', async () => {
    const { restaurants } = fixture();

    const deactivatedMenu = await restaurants.setMenuActive(
      userId,
      businessId,
      serviceId,
      menuId,
      false,
    );
    const reactivatedMenu = await restaurants.setMenuActive(
      userId,
      businessId,
      serviceId,
      menuId,
      true,
    );
    const unavailableItem = await restaurants.setMenuItemAvailable(
      userId,
      businessId,
      serviceId,
      menuId,
      itemId,
      false,
    );
    const availableItem = await restaurants.setMenuItemAvailable(
      userId,
      businessId,
      serviceId,
      menuId,
      itemId,
      true,
    );

    expect(deactivatedMenu).toMatchObject({
      id: menuId,
      items: [{ id: itemId }],
    });
    expect(reactivatedMenu).toMatchObject({
      id: menuId,
      items: [{ id: itemId }],
    });
    expect(unavailableItem).toMatchObject({ id: itemId });
    expect(availableItem).toMatchObject({ id: itemId });
  });

  it('enforces scoped menu and item application limits across inactive and unavailable rows', async () => {
    const belowMenuLimit = fixture();
    belowMenuLimit.menuCount.mockResolvedValue(MAX_RESTAURANT_MENUS - 1);
    await expect(
      belowMenuLimit.restaurants.createMenu(userId, businessId, serviceId, {
        name: 'Dinner',
      }),
    ).resolves.toMatchObject({ id: menuId });
    expect(belowMenuLimit.menuCount).toHaveBeenCalledWith({
      where: { restaurantDetailId: detailId },
    });

    const atMenuLimit = fixture();
    atMenuLimit.menuCount.mockResolvedValue(MAX_RESTAURANT_MENUS);
    await expect(
      atMenuLimit.restaurants.createMenu(userId, businessId, serviceId, {
        name: 'Dinner',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(atMenuLimit.menuCreate).not.toHaveBeenCalled();
    expect(atMenuLimit.menuCount).toHaveBeenCalledWith({
      where: { restaurantDetailId: detailId },
    });

    const belowItemLimit = fixture();
    belowItemLimit.itemCount.mockResolvedValue(MAX_RESTAURANT_MENU_ITEMS - 1);
    await expect(
      belowItemLimit.restaurants.createMenuItem(
        userId,
        businessId,
        serviceId,
        menuId,
        { name: 'Kocho', price: '10.00', currency: 'ETB' },
      ),
    ).resolves.toMatchObject({ id: itemId });
    expect(belowItemLimit.itemCount).toHaveBeenCalledWith({
      where: { menuId },
    });

    const atItemLimit = fixture();
    atItemLimit.itemCount.mockResolvedValue(MAX_RESTAURANT_MENU_ITEMS);
    await expect(
      atItemLimit.restaurants.createMenuItem(
        userId,
        businessId,
        serviceId,
        menuId,
        { name: 'Kocho', price: '10.00', currency: 'ETB' },
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(atItemLimit.itemCreate).not.toHaveBeenCalled();
    expect(atItemLimit.itemCount).toHaveBeenCalledWith({
      where: { menuId },
    });
  });
});
