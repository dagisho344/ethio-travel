import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Server } from 'node:http';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AuthenticatedUser } from '../src/auth/authenticated-user';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import { RestaurantsService } from '../src/restaurants/restaurants.service';

const businessId = '22222222-2222-4222-8222-222222222222';
const serviceId = '33333333-3333-4333-8333-333333333333';
const menuId = '44444444-4444-4444-8444-444444444444';
const itemId = '55555555-5555-4555-8555-555555555555';
let allowAuth = true;
const user: AuthenticatedUser = {
  email: 'owner@example.com',
  roles: ['BUSINESS_OWNER'],
  sessionId: 'session',
  sub: '11111111-1111-4111-8111-111111111111',
};
const restaurant = {
  service: {
    id: serviceId,
    name: 'Wolaita Kitchen',
    status: 'DRAFT',
    category: { code: 'MEAL', family: 'RESTAURANT', name: 'Meal' },
  },
  detail: {
    id: '66666666-6666-4666-8666-666666666666',
    cuisineTypes: ['Ethiopian'],
    reservationSupported: true,
    deliverySupported: false,
  },
  menus: [],
};

class TestJwtGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    if (!allowAuth) throw new UnauthorizedException();
    context.switchToHttp().getRequest<{ user: AuthenticatedUser }>().user =
      user;
    return true;
  }
}

describe('Phase 14C restaurant routes', () => {
  let app: INestApplication | undefined;
  let httpServer: Server;
  const findMine = jest.fn().mockResolvedValue(restaurant);
  const updateDetail = jest.fn().mockResolvedValue(restaurant);
  const listMenus = jest.fn().mockResolvedValue([]);
  const createMenu = jest.fn().mockResolvedValue({ id: menuId });
  const updateMenu = jest.fn().mockResolvedValue({ id: menuId });
  const setMenuActive = jest.fn().mockResolvedValue({ id: menuId });
  const listMenuItems = jest.fn().mockResolvedValue([]);
  const createMenuItem = jest.fn().mockResolvedValue({ id: itemId });
  const updateMenuItem = jest.fn().mockResolvedValue({ id: itemId });
  const setMenuItemAvailable = jest.fn().mockResolvedValue({ id: itemId });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({ isHealthy: () => Promise.resolve(true) })
      .overrideProvider(RedisService)
      .useValue({ isHealthy: () => Promise.resolve(true) })
      .overrideProvider(RestaurantsService)
      .useValue({
        findMine,
        updateDetail,
        listMenus,
        createMenu,
        updateMenu,
        setMenuActive,
        listMenuItems,
        createMenuItem,
        updateMenuItem,
        setMenuItemAvailable,
      })
      .overrideGuard(JwtAuthGuard)
      .useClass(TestJwtGuard)
      .compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        forbidNonWhitelisted: true,
        transform: true,
        whitelist: true,
      }),
    );
    await app.init();
    httpServer = app.getHttpServer() as Server;
  });

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(() => {
    allowAuth = true;
    jest.clearAllMocks();
  });

  const basePath = `/api/v1/my/businesses/${businessId}/services/${serviceId}/restaurant`;

  it('serves restaurant detail, menu, and menu-item routes to an authenticated business member', async () => {
    await request(httpServer).get(basePath).expect(200);
    await request(httpServer).get(`${basePath}/menus`).expect(200);
    await request(httpServer)
      .patch(basePath)
      .send({
        cuisineTypes: ['Ethiopian', 'Wolaita'],
        reservationSupported: true,
        deliverySupported: false,
      })
      .expect(200);
    await request(httpServer)
      .post(`${basePath}/menus`)
      .send({ name: 'Main menu', sortOrder: 0 })
      .expect(201);
    await request(httpServer)
      .patch(`${basePath}/menus/${menuId}`)
      .send({ name: 'Updated menu' })
      .expect(200);
    await request(httpServer)
      .post(`${basePath}/menus/${menuId}/activate`)
      .expect(200);
    await request(httpServer)
      .post(`${basePath}/menus/${menuId}/deactivate`)
      .expect(200);
    await request(httpServer)
      .get(`${basePath}/menus/${menuId}/items`)
      .expect(200);
    await request(httpServer)
      .post(`${basePath}/menus/${menuId}/items`)
      .send({ name: 'Kocho', price: '250.00', currency: 'ETB', sortOrder: 0 })
      .expect(201);
    await request(httpServer)
      .patch(`${basePath}/menus/${menuId}/items/${itemId}`)
      .send({ section: 'Mains' })
      .expect(200);
    await request(httpServer)
      .post(`${basePath}/menus/${menuId}/items/${itemId}/available`)
      .expect(200);
    await request(httpServer)
      .post(`${basePath}/menus/${menuId}/items/${itemId}/unavailable`)
      .expect(200);

    expect(updateDetail).toHaveBeenCalledWith(
      user.sub,
      businessId,
      serviceId,
      expect.objectContaining({ cuisineTypes: ['Ethiopian', 'Wolaita'] }),
    );
    expect(setMenuActive).toHaveBeenNthCalledWith(
      1,
      user.sub,
      businessId,
      serviceId,
      menuId,
      true,
    );
    expect(setMenuItemAvailable).toHaveBeenLastCalledWith(
      user.sub,
      businessId,
      serviceId,
      menuId,
      itemId,
      false,
    );
  });

  it('rejects invalid cuisines, menu and item input, unknown fields, and malformed identifiers', async () => {
    await request(httpServer)
      .patch(basePath)
      .send({ cuisineTypes: ['   '], unknown: true })
      .expect(400);
    await request(httpServer)
      .post(`${basePath}/menus`)
      .send({ name: '   ', sortOrder: -1 })
      .expect(400);
    await request(httpServer)
      .post(`${basePath}/menus`)
      .send({ name: 'Main', sortOrder: 1.5 })
      .expect(400);
    await request(httpServer)
      .post(`${basePath}/menus/${menuId}/items`)
      .send({ name: 'Kocho', price: '-1', currency: 'etb', sortOrder: -1 })
      .expect(400);
    await request(httpServer)
      .post(`${basePath}/menus/${menuId}/items`)
      .send({ name: 'Kocho', price: '12.345', currency: 'ETB', sortOrder: 1.5 })
      .expect(400);
    await request(httpServer)
      .get('/api/v1/my/businesses/not-a-uuid/services/not-a-uuid/restaurant')
      .expect(400);
  });

  it('does not expose delete, restaurant booking, or restaurant availability routes', async () => {
    await request(httpServer).delete(`${basePath}/menus/${menuId}`).expect(404);
    await request(httpServer)
      .delete(`${basePath}/menus/${menuId}/items/${itemId}`)
      .expect(404);
    await request(httpServer).post(`${basePath}/bookings`).expect(404);
    await request(httpServer).post(`${basePath}/availability`).expect(404);
  });

  it('requires authentication for restaurant routes', async () => {
    allowAuth = false;
    await request(httpServer).get(basePath).expect(401);
  });
});
