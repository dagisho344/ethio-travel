import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma, UserStatus } from '@prisma/client';
import * as argon2 from 'argon2';
import { AppConfig } from '../config/app.config';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { AuthResponseDto, MessageResponseDto } from './dto/auth-response.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { RoleName } from './roles.constants';
import { createSecureToken, hashToken } from './token.util';

const authUserInclude = {
  profile: true,
  roles: { include: { role: true } },
} satisfies Prisma.UserInclude;

type AuthUser = Prisma.UserGetPayload<{ include: typeof authUserInclude }>;

export interface RequestMetadata {
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly config: ConfigService<AppConfig, true>,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
  ) {}

  async register(
    dto: RegisterDto,
    metadata: RequestMetadata,
  ): Promise<AuthResponseDto> {
    const email = dto.email.toLowerCase().trim();
    const passwordHash = await argon2.hash(dto.password);

    try {
      const user = await this.prisma.$transaction(async (tx) => {
        const role = await tx.role.upsert({
          create: {
            description: 'Default traveler account role.',
            name: 'TRAVELER',
          },
          update: {},
          where: { name: 'TRAVELER' },
        });

        return tx.user.create({
          data: {
            email,
            passwordHash,
            profile: {
              create: {
                firstName: dto.firstName,
                lastName: dto.lastName,
              },
            },
            roles: {
              create: {
                roleId: role.id,
              },
            },
          },
          include: authUserInclude,
        });
      });

      return this.createAuthResponse(user, metadata);
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException('Email is already registered.');
      }
      throw error;
    }
  }

  async login(
    dto: LoginDto,
    metadata: RequestMetadata,
  ): Promise<AuthResponseDto> {
    const user = await this.prisma.user.findUnique({
      include: authUserInclude,
      where: { email: dto.email.toLowerCase().trim() },
    });

    if (!this.isActiveUser(user)) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    const passwordMatches = await argon2.verify(
      user.passwordHash,
      dto.password,
    );

    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    await this.prisma.user.update({
      data: { lastLoginAt: new Date() },
      where: { id: user.id },
    });

    return this.createAuthResponse(user, metadata);
  }

  async refresh(
    dto: RefreshTokenDto,
    metadata: RequestMetadata,
  ): Promise<AuthResponseDto> {
    const refreshTokenHash = hashToken(dto.refreshToken);
    const session = await this.prisma.session.findUnique({
      include: { user: { include: authUserInclude } },
      where: { refreshTokenHash },
    });

    if (!session) {
      throw new UnauthorizedException('Invalid refresh token.');
    }

    if (!this.isActiveUser(session.user)) {
      throw new UnauthorizedException('Invalid refresh token.');
    }

    const now = new Date();
    if (session.revokedAt || session.rotatedAt || session.expiresAt <= now) {
      await this.revokeUserSessions(session.userId);
      throw new UnauthorizedException('Refresh token has been revoked.');
    }

    const nextRefreshToken = createSecureToken();
    const nextRefreshTokenHash = hashToken(nextRefreshToken);
    const expiresAt = this.getRefreshExpiry();

    const nextSession = await this.prisma.$transaction(async (tx) => {
      const rotation = await tx.session.updateMany({
        data: {
          rotatedAt: now,
          revokedAt: now,
        },
        where: {
          expiresAt: { gt: now },
          id: session.id,
          revokedAt: null,
          rotatedAt: null,
        },
      });

      if (rotation.count !== 1) {
        throw new UnauthorizedException('Refresh token has been revoked.');
      }

      const createdSession = await tx.session.create({
        data: {
          expiresAt,
          ipAddress: metadata.ipAddress,
          refreshTokenHash: nextRefreshTokenHash,
          userAgent: metadata.userAgent,
          userId: session.userId,
        },
      });

      await tx.session.update({
        data: { replacedById: createdSession.id },
        where: { id: session.id },
      });

      return createdSession;
    });

    return {
      accessToken: await this.signAccessToken(session.user, nextSession.id),
      refreshToken: nextRefreshToken,
      user: this.usersService.toSafeUser(session.user),
    };
  }

  async logout(sessionId: string): Promise<MessageResponseDto> {
    await this.prisma.session.updateMany({
      data: { revokedAt: new Date() },
      where: { id: sessionId, revokedAt: null },
    });

    return { message: 'Logged out successfully.' };
  }

  async requestPasswordReset(
    dto: ForgotPasswordDto,
  ): Promise<MessageResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
    });

    if (user) {
      const token = createSecureToken();
      await this.prisma.passwordResetToken.create({
        data: {
          expiresAt: this.getPasswordResetExpiry(),
          tokenHash: hashToken(token),
          userId: user.id,
        },
      });
      // Email delivery/rate limiting plugs in here; plaintext reset token is never returned.
    }

    return {
      message: 'If the email exists, password reset instructions will be sent.',
    };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<MessageResponseDto> {
    const tokenHash = hashToken(dto.token);
    const resetToken = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
    });

    if (!resetToken) {
      throw new UnauthorizedException('Invalid password reset token.');
    }

    const now = new Date();
    if (resetToken.usedAt || resetToken.expiresAt <= now) {
      throw new UnauthorizedException('Invalid password reset token.');
    }

    const passwordHash = await argon2.hash(dto.password);

    await this.prisma.$transaction(async (tx) => {
      const consumed = await tx.passwordResetToken.updateMany({
        data: { usedAt: now },
        where: {
          expiresAt: { gt: now },
          id: resetToken.id,
          usedAt: null,
        },
      });

      if (consumed.count !== 1) {
        throw new UnauthorizedException('Invalid password reset token.');
      }

      await tx.user.update({
        data: { passwordHash },
        where: { id: resetToken.userId },
      });
      await tx.passwordResetToken.updateMany({
        data: { usedAt: now },
        where: {
          id: { not: resetToken.id },
          userId: resetToken.userId,
          usedAt: null,
        },
      });
      await tx.session.updateMany({
        data: { revokedAt: now },
        where: { userId: resetToken.userId, revokedAt: null },
      });
    });

    return { message: 'Password reset successfully.' };
  }

  private async createAuthResponse(
    user: AuthUser,
    metadata: RequestMetadata,
  ): Promise<AuthResponseDto> {
    const refreshToken = createSecureToken();
    const session = await this.prisma.session.create({
      data: {
        expiresAt: this.getRefreshExpiry(),
        ipAddress: metadata.ipAddress,
        refreshTokenHash: hashToken(refreshToken),
        userAgent: metadata.userAgent,
        userId: user.id,
      },
    });

    return {
      accessToken: await this.signAccessToken(user, session.id),
      refreshToken,
      user: this.usersService.toSafeUser(user),
    };
  }

  private async signAccessToken(
    user: AuthUser,
    sessionId: string,
  ): Promise<string> {
    const roles = user.roles.map((userRole) => userRole.role.name as RoleName);

    return this.jwtService.signAsync({
      email: user.email,
      roles,
      sessionId,
      sub: user.id,
    });
  }

  private getRefreshExpiry(): Date {
    const days = this.config.get('refreshTokenExpiresDays', { infer: true });
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }

  private getPasswordResetExpiry(): Date {
    const minutes = this.config.get('passwordResetTokenExpiresMinutes', {
      infer: true,
    });
    return new Date(Date.now() + minutes * 60 * 1000);
  }

  private async revokeUserSessions(userId: string): Promise<void> {
    await this.prisma.session.updateMany({
      data: { revokedAt: new Date() },
      where: { userId, revokedAt: null },
    });
  }

  private isActiveUser(user: AuthUser | null): user is AuthUser {
    return Boolean(user && user.status === UserStatus.ACTIVE);
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }
}
