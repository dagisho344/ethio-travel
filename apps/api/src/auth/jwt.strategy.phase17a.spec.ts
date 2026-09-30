import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserStatus } from '@prisma/client';
import { AppConfig } from '../config/app.config';
import { PrismaService } from '../prisma/prisma.service';
import { JwtStrategy } from './strategies/jwt.strategy';

const payload = {
  email: 'traveler@example.com',
  roles: ['TRAVELER'],
  sessionId: '22222222-2222-4222-8222-222222222222',
  sub: '11111111-1111-4111-8111-111111111111',
};

describe('Phase 17A-1 access-token session invalidation', () => {
  const findFirst = jest.fn<Promise<{ id: string } | null>, [unknown]>();
  const config = {
    get: () => 'test-access-secret-with-sufficient-length',
  } as unknown as ConfigService<AppConfig, true>;
  const prisma = {
    session: { findFirst },
  } as unknown as PrismaService;
  const strategy = new JwtStrategy(config, prisma);

  beforeEach(() => findFirst.mockReset());

  it('accepts an existing access token only while its session and user are active', async () => {
    findFirst.mockResolvedValue({ id: payload.sessionId });
    await expect(strategy.validate(payload)).resolves.toEqual(payload);
    expect(findFirst).toHaveBeenCalledWith({
      where: {
        expiresAt: { gt: expect.any(Date) as Date },
        id: payload.sessionId,
        revokedAt: null,
        userId: payload.sub,
        user: { status: UserStatus.ACTIVE },
      },
      select: { id: true },
    });
  });

  it('rejects the same token immediately after session revocation or account deactivation', async () => {
    findFirst.mockResolvedValue(null);
    await expect(strategy.validate(payload)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects tokens without session identity before querying the database', async () => {
    await expect(
      strategy.validate({ ...payload, sessionId: '' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(findFirst).not.toHaveBeenCalled();
  });
});
