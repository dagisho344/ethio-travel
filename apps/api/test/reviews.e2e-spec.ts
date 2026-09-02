/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ReviewStatus } from '@prisma/client';
import type { Server } from 'node:http';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AuthenticatedUser } from '../src/auth/authenticated-user';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { ReviewTargetType } from '../src/reviews/dto/review-target-type.enum';
import { ReviewsService } from '../src/reviews/reviews.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';

let allowAuth = true;
const user: AuthenticatedUser = {
  email: 'traveler@example.com',
  roles: ['TRAVELER'],
  sessionId: 'session',
  sub: '11111111-1111-4111-8111-111111111111',
};

const review = {
  id: '22222222-2222-4222-8222-222222222222',
  rating: 5,
  title: 'Great',
  body: 'Helpful visit.',
  status: ReviewStatus.PENDING,
  moderationNote: null,
  moderatedAt: null,
  publishedAt: null,
  hiddenAt: null,
  rejectedAt: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  target: {
    type: ReviewTargetType.BUSINESS,
    id: '33333333-3333-4333-8333-333333333333',
    name: 'Public Business',
    slug: 'public-business',
    category: { code: 'HOTEL', name: 'Hotel' },
    city: { name: 'Bole', slug: 'bole' },
    region: { name: 'Addis Ababa', slug: 'addis-ababa' },
    destination: null,
  },
};

const publicReview = {
  id: review.id,
  rating: 5,
  title: 'Great',
  body: 'Helpful visit.',
  author: { displayName: 'Dagi Traveler' },
  publishedAt: new Date('2026-01-02T00:00:00.000Z'),
  createdAt: review.createdAt,
};

class TestJwtGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    if (!allowAuth) throw new UnauthorizedException();
    context.switchToHttp().getRequest<{ user: AuthenticatedUser }>().user =
      user;
    return true;
  }
}

describe('Phase 6C review routes', () => {
  let app: INestApplication | undefined;
  let httpServer: Server;
  const reviewsService = {
    create: jest.fn(() => Promise.resolve(review)),
    findMine: jest.fn(() =>
      Promise.resolve({
        data: [review],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      }),
    ),
    findPublic: jest.fn(() =>
      Promise.resolve({
        data: [publicReview],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      }),
    ),
    summary: jest.fn(() =>
      Promise.resolve({
        averageRating: 4.3,
        reviewCount: 27,
        ratingDistribution: { '1': 1, '2': 2, '3': 4, '4': 8, '5': 12 },
      }),
    ),
    update: jest.fn(() => Promise.resolve({ ...review, rating: 4 })),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({ isHealthy: () => Promise.resolve(true) })
      .overrideProvider(RedisService)
      .useValue({ isHealthy: () => Promise.resolve(true) })
      .overrideProvider(ReviewsService)
      .useValue(reviewsService)
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

  it('requires authentication for create, edit, and own list', async () => {
    allowAuth = false;
    await request(httpServer).post('/api/v1/reviews').send({}).expect(401);
    await request(httpServer).get('/api/v1/users/me/reviews').expect(401);
    await request(httpServer)
      .patch('/api/v1/reviews/22222222-2222-4222-8222-222222222222')
      .send({ rating: 4 })
      .expect(401);
  });

  it('creates a review for the authenticated user', async () => {
    await request(httpServer)
      .post('/api/v1/reviews')
      .send({
        targetType: ReviewTargetType.BUSINESS,
        targetId: '33333333-3333-4333-8333-333333333333',
        rating: 5,
        title: ' Great ',
        body: ' Helpful ',
      })
      .expect(201);
    expect(reviewsService.create).toHaveBeenCalledWith(
      user.sub,
      expect.objectContaining({
        targetType: ReviewTargetType.BUSINESS,
        targetId: '33333333-3333-4333-8333-333333333333',
        rating: 5,
        title: 'Great',
        body: 'Helpful',
      }),
    );
  });

  it('rejects invalid target and rating input', async () => {
    await request(httpServer)
      .post('/api/v1/reviews')
      .send({ targetType: 'BOOKING', targetId: 'bad', rating: 6 })
      .expect(400);
    await request(httpServer)
      .post('/api/v1/reviews')
      .send({
        targetType: ReviewTargetType.BUSINESS,
        targetId: '33333333-3333-4333-8333-333333333333',
        rating: 0,
      })
      .expect(400);
    await request(httpServer)
      .post('/api/v1/reviews')
      .send({
        targetType: ReviewTargetType.BUSINESS,
        targetId: '33333333-3333-4333-8333-333333333333',
        rating: 1.5,
      })
      .expect(400);
  });

  it('lists own reviews with filters', async () => {
    await request(httpServer)
      .get(
        '/api/v1/users/me/reviews?targetType=BUSINESS&status=PENDING&page=1&limit=20',
      )
      .expect(200);
    expect(reviewsService.findMine).toHaveBeenCalledWith(
      user.sub,
      expect.objectContaining({
        targetType: ReviewTargetType.BUSINESS,
        status: ReviewStatus.PENDING,
        page: 1,
        limit: 20,
      }),
    );
  });

  it('edits an owned review', async () => {
    await request(httpServer)
      .patch('/api/v1/reviews/22222222-2222-4222-8222-222222222222')
      .send({ rating: 4, title: ' Updated ' })
      .expect(200);
    expect(reviewsService.update).toHaveBeenCalledWith(
      user.sub,
      '22222222-2222-4222-8222-222222222222',
      expect.objectContaining({ rating: 4, title: 'Updated' }),
    );
  });

  it('serves public reviews and summary without authentication', async () => {
    allowAuth = false;
    await request(httpServer)
      .get(
        '/api/v1/reviews?targetType=BUSINESS&targetId=33333333-3333-4333-8333-333333333333&rating=5&sort=newest',
      )
      .expect(200)
      .expect(({ body }) => {
        expect(body.data[0].author.displayName).toBe('Dagi Traveler');
        expect(body.data[0].author.email).toBeUndefined();
        expect(body.data[0].moderationNote).toBeUndefined();
      });
    await request(httpServer)
      .get(
        '/api/v1/reviews/summary?targetType=BUSINESS&targetId=33333333-3333-4333-8333-333333333333',
      )
      .expect(200);
  });
});
