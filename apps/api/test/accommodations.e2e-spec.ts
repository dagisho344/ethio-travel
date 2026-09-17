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
import { AccommodationService } from '../src/accommodations/accommodations.service';
import { AuthenticatedUser } from '../src/auth/authenticated-user';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';

const businessId = '22222222-2222-4222-8222-222222222222';
const serviceId = '33333333-3333-4333-8333-333333333333';
const roomTypeId = '44444444-4444-4444-8444-444444444444';
let allowAuth = true;
const user: AuthenticatedUser = {
  email: 'owner@example.com',
  roles: ['BUSINESS_OWNER'],
  sessionId: 'session',
  sub: '11111111-1111-4111-8111-111111111111',
};
const accommodation = {
  service: {
    id: serviceId,
    name: 'Deluxe room',
    status: 'DRAFT',
    category: { code: 'ROOM', name: 'Room' },
  },
  detail: {
    id: '55555555-5555-4555-8555-555555555555',
    starClass: 4,
    checkInTime: '14:00',
    checkOutTime: '11:00',
  },
  roomTypes: [],
};

class TestJwtGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    if (!allowAuth) throw new UnauthorizedException();
    context.switchToHttp().getRequest<{ user: AuthenticatedUser }>().user =
      user;
    return true;
  }
}

describe('Phase 14B accommodation routes', () => {
  let app: INestApplication | undefined;
  let httpServer: Server;
  const findMine = jest.fn().mockResolvedValue(accommodation);
  const updateDetail = jest.fn().mockResolvedValue(accommodation);
  const listRooms = jest.fn().mockResolvedValue([]);
  const createRoom = jest.fn().mockResolvedValue({ id: roomTypeId });
  const updateRoom = jest.fn().mockResolvedValue({ id: roomTypeId });
  const setRoomActive = jest.fn().mockResolvedValue({ id: roomTypeId });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({ isHealthy: () => Promise.resolve(true) })
      .overrideProvider(RedisService)
      .useValue({ isHealthy: () => Promise.resolve(true) })
      .overrideProvider(AccommodationService)
      .useValue({
        findMine,
        updateDetail,
        listRooms,
        createRoom,
        updateRoom,
        setRoomActive,
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

  const basePath = `/api/v1/my/businesses/${businessId}/services/${serviceId}/accommodation`;

  it('serves the implemented accommodation and room routes to an authenticated business member', async () => {
    await request(httpServer).get(basePath).expect(200);
    await request(httpServer).get(`${basePath}/rooms`).expect(200);
    await request(httpServer)
      .patch(basePath)
      .send({ starClass: 4, checkInTime: '14:00', checkOutTime: '11:00' })
      .expect(200);
    await request(httpServer)
      .post(`${basePath}/rooms`)
      .send({
        name: 'Deluxe King',
        capacity: 2,
        basePrice: '1250.00',
        currency: 'ETB',
        quantity: 4,
      })
      .expect(201);
    await request(httpServer)
      .patch(`${basePath}/rooms/${roomTypeId}`)
      .send({ quantity: 3 })
      .expect(200);
    await request(httpServer)
      .post(`${basePath}/rooms/${roomTypeId}/activate`)
      .expect(200);
    await request(httpServer)
      .post(`${basePath}/rooms/${roomTypeId}/deactivate`)
      .expect(200);
    expect(updateDetail).toHaveBeenCalledWith(
      user.sub,
      businessId,
      serviceId,
      expect.objectContaining({ starClass: 4 }),
    );
    expect(setRoomActive).toHaveBeenNthCalledWith(
      1,
      user.sub,
      businessId,
      serviceId,
      roomTypeId,
      true,
    );
  });

  it('rejects invalid room values, unknown fields, and malformed identifiers', async () => {
    await request(httpServer)
      .post(`${basePath}/rooms`)
      .send({
        name: 'Deluxe King',
        capacity: 0,
        basePrice: '-1',
        currency: 'etb',
        quantity: -1,
      })
      .expect(400);
    await request(httpServer)
      .post(`${basePath}/rooms`)
      .send({
        name: '   ',
        capacity: 2,
        basePrice: '1250.00',
        currency: 'ETB',
        quantity: 0,
      })
      .expect(400);
    await request(httpServer)
      .patch(basePath)
      .send({ checkInTime: '25:00', unknown: true })
      .expect(400);
    await request(httpServer)
      .get('/api/v1/my/businesses/not-a-uuid/services/not-a-uuid/accommodation')
      .expect(400);
  });

  it('does not expose delete, booking allocation, or inventory mutation routes', async () => {
    await request(httpServer)
      .delete(`${basePath}/rooms/${roomTypeId}`)
      .expect(404);
    await request(httpServer)
      .post(`${basePath}/rooms/${roomTypeId}/reserve`)
      .expect(404);
    await request(httpServer).post(`${basePath}/booking-inventory`).expect(404);
  });

  it('requires authentication for accommodation routes', async () => {
    allowAuth = false;
    await request(httpServer).get(basePath).expect(401);
  });
});
