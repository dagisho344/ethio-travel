import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma, UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import { hashToken } from './token.util';

jest.mock('argon2', () => ({
  hash: jest.fn(() => Promise.resolve('hashed-password')),
  verify: jest.fn(() => Promise.resolve(true)),
}));

const activeUser = {
  createdAt: new Date(),
  email: 'traveler@example.com',
  emailVerifiedAt: null,
  id: 'user-id',
  lastLoginAt: null,
  passwordHash: 'hashed-password',
  profile: null,
  roles: [{ role: { name: 'TRAVELER' } }],
  status: UserStatus.ACTIVE,
  updatedAt: new Date(),
};

function createService(prismaMock: unknown): AuthService {
  return new AuthService(
    {
      get: (key: string) => {
        if (key === 'refreshTokenExpiresDays') {
          return 30;
        }
        if (key === 'passwordResetTokenExpiresMinutes') {
          return 30;
        }
        return 'test-secret-with-at-least-thirty-two-characters';
      },
    } as never,
    {
      signAsync: jest.fn(() => Promise.resolve('access-token')),
    } as unknown as JwtService,
    prismaMock as PrismaService,
    {
      toSafeUser: jest.fn(() => ({
        email: activeUser.email,
        firstName: null,
        id: activeUser.id,
        lastName: null,
        phone: null,
        roles: ['TRAVELER'],
      })),
    } as unknown as UsersService,
  );
}

describe('AuthService pre-migration safety behavior', () => {
  it.each([UserStatus.SUSPENDED, UserStatus.DEACTIVATED])(
    'rejects %s user login',
    async (status) => {
      const service = createService({
        user: {
          findUnique: jest.fn(() => Promise.resolve({ ...activeUser, status })),
        },
      });

      await expect(
        service.login(
          { email: activeUser.email, password: 'StrongerPass123!' },
          {},
        ),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    },
  );

  it.each([UserStatus.SUSPENDED, UserStatus.DEACTIVATED])(
    'rejects %s user refresh',
    async (status) => {
      const service = createService({
        session: {
          findUnique: jest.fn(() =>
            Promise.resolve({
              expiresAt: new Date(Date.now() + 10000),
              id: 'session-id',
              revokedAt: null,
              rotatedAt: null,
              user: { ...activeUser, status },
              userId: activeUser.id,
            }),
          ),
        },
      });

      await expect(
        service.refresh({ refreshToken: 'refresh-token' }, {}),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    },
  );

  it('rejects refresh token replay after rotation', async () => {
    const service = createService({
      session: {
        findUnique: jest.fn(() =>
          Promise.resolve({
            expiresAt: new Date(Date.now() + 10000),
            id: 'session-id',
            revokedAt: new Date(),
            rotatedAt: new Date(),
            user: activeUser,
            userId: activeUser.id,
          }),
        ),
        updateMany: jest.fn(() => Promise.resolve({ count: 1 })),
      },
    });

    await expect(
      service.refresh({ refreshToken: 'refresh-token' }, {}),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('allows only one simultaneous refresh rotation', async () => {
    let available = true;
    const tx = {
      session: {
        create: jest.fn(() =>
          Promise.resolve({ id: 'next-session-id', userId: activeUser.id }),
        ),
        update: jest.fn(() => Promise.resolve({})),
        updateMany: jest.fn(() => {
          if (available) {
            available = false;
            return Promise.resolve({ count: 1 });
          }
          return Promise.resolve({ count: 0 });
        }),
      },
    };
    const service = createService({
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
        Promise.resolve(callback(tx)),
      ),
      session: {
        findUnique: jest.fn(() =>
          Promise.resolve({
            expiresAt: new Date(Date.now() + 10000),
            id: 'session-id',
            revokedAt: null,
            rotatedAt: null,
            user: activeUser,
            userId: activeUser.id,
          }),
        ),
      },
    });

    const results = await Promise.allSettled([
      service.refresh({ refreshToken: 'refresh-token' }, {}),
      service.refresh({ refreshToken: 'refresh-token' }, {}),
    ]);

    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === 'rejected'),
    ).toHaveLength(1);
    expect(tx.session.create).toHaveBeenCalledTimes(1);
  });

  it('consumes a password reset token only once and invalidates siblings', async () => {
    const resetToken = {
      expiresAt: new Date(Date.now() + 10000),
      id: 'reset-token-id',
      tokenHash: hashToken('reset-token'),
      usedAt: null,
      userId: activeUser.id,
    };
    const tx = {
      passwordResetToken: {
        updateMany: jest
          .fn()
          .mockResolvedValueOnce({ count: 1 })
          .mockResolvedValueOnce({ count: 2 })
          .mockResolvedValueOnce({ count: 0 }),
      },
      session: { updateMany: jest.fn(() => Promise.resolve({ count: 3 })) },
      user: { update: jest.fn(() => Promise.resolve(activeUser)) },
    };
    const service = createService({
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
        Promise.resolve(callback(tx)),
      ),
      passwordResetToken: {
        findUnique: jest.fn(() => Promise.resolve(resetToken)),
      },
    });

    await expect(
      service.resetPassword({
        password: 'NewPassword123!',
        token: 'reset-token',
      }),
    ).resolves.toEqual({ message: 'Password reset successfully.' });

    await expect(
      service.resetPassword({
        password: 'NewPassword123!',
        token: 'reset-token',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    /* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
    const siblingInvalidationCall =
      tx.passwordResetToken.updateMany.mock.calls[1]?.[0];
    expect(siblingInvalidationCall?.where).toMatchObject({
      id: { not: resetToken.id },
      userId: activeUser.id,
      usedAt: null,
    });
    /* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
  });

  it('returns conflict when duplicate registration races into a unique constraint', async () => {
    const duplicateError = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed',
      { clientVersion: 'test', code: 'P2002' },
    );
    const service = createService({
      $transaction: jest.fn(() => Promise.reject(duplicateError)),
    });

    await expect(
      service.register(
        { email: activeUser.email, password: 'StrongerPass123!' },
        {},
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
