import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserStatus } from '@prisma/client';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AppConfig } from '../../config/app.config';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../authenticated-user';

interface JwtPayload {
  email: string;
  roles: string[];
  sessionId: string;
  sub: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService<AppConfig, true>,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get('jwtAccessSecret', { infer: true }),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    if (!payload.sub || !payload.sessionId) {
      throw new UnauthorizedException('Invalid access token.');
    }

    const activeSession = await this.prisma.session.findFirst({
      where: {
        expiresAt: { gt: new Date() },
        id: payload.sessionId,
        revokedAt: null,
        userId: payload.sub,
        user: { status: UserStatus.ACTIVE },
      },
      select: { id: true },
    });
    if (!activeSession) {
      throw new UnauthorizedException('Authentication required.');
    }

    return payload;
  }
}
