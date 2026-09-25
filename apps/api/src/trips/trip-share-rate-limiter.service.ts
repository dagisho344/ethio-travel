import {
  HttpException,
  HttpStatus,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { hashToken } from '../auth/token.util';
import { AppConfig } from '../config/app.config';
import { RedisService } from '../redis/redis.service';
import {
  TRIP_SHARE_IP_REQUESTS_PER_WINDOW,
  TRIP_SHARE_RATE_WINDOW_SECONDS,
  TRIP_SHARE_TOKEN_REQUESTS_PER_WINDOW,
} from './trip-share.constants';

type MemoryCounter = { count: number; expiresAt: number };

@Injectable()
export class TripShareRateLimiterService {
  private readonly fallback = new Map<string, MemoryCounter>();

  constructor(
    private readonly config: ConfigService<AppConfig, true>,
    private readonly redis: RedisService,
  ) {}

  async consume(
    tokenHash: string,
    remoteAddress: string | undefined,
  ): Promise<void> {
    await this.consumeKey(
      `ethio:trip-share:token:${tokenHash}`,
      TRIP_SHARE_TOKEN_REQUESTS_PER_WINDOW,
    );
    const addressHash = hashToken(remoteAddress ?? 'unknown');
    await this.consumeKey(
      `ethio:trip-share:ip:${addressHash}`,
      TRIP_SHARE_IP_REQUESTS_PER_WINDOW,
    );
  }

  private async consumeKey(key: string, limit: number): Promise<void> {
    const distributedCount = await this.redis.incrementWithExpiry(
      key,
      TRIP_SHARE_RATE_WINDOW_SECONDS,
    );
    const count =
      distributedCount ??
      (this.config.get('nodeEnv', { infer: true }) === 'production'
        ? this.failClosed()
        : this.consumeFallback(key));
    if (count > limit) {
      throw new HttpException(
        'Too many share-link requests. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private failClosed(): never {
    throw new ServiceUnavailableException(
      'Share links are temporarily unavailable.',
    );
  }

  private consumeFallback(key: string): number {
    const now = Date.now();
    const current = this.fallback.get(key);
    if (!current || current.expiresAt <= now) {
      this.fallback.set(key, {
        count: 1,
        expiresAt: now + TRIP_SHARE_RATE_WINDOW_SECONDS * 1000,
      });
      return 1;
    }
    current.count += 1;
    return current.count;
  }
}
