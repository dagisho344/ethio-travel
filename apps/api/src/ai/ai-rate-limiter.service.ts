import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../config/app.config';
import { RedisService } from '../redis/redis.service';

const WINDOW_SECONDS = 60 * 60;

type MemoryCounter = { count: number; expiresAt: number };

@Injectable()
export class AiRateLimiterService {
  private readonly fallback = new Map<string, MemoryCounter>();

  constructor(
    private readonly config: ConfigService<AppConfig, true>,
    private readonly redis: RedisService,
  ) {}

  async consume(userId: string): Promise<void> {
    const key = `ethio:ai:rate:${userId}`;
    const distributedCount = await this.redis.incrementWithExpiry(
      key,
      WINDOW_SECONDS,
    );
    const count = distributedCount ?? this.consumeFallback(key);
    if (count > this.config.get('aiRequestsPerHour', { infer: true })) {
      throw new HttpException(
        'AI request limit reached. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private consumeFallback(key: string): number {
    const now = Date.now();
    const current = this.fallback.get(key);
    if (!current || current.expiresAt <= now) {
      this.fallback.set(key, {
        count: 1,
        expiresAt: now + WINDOW_SECONDS * 1000,
      });
      return 1;
    }
    current.count += 1;
    return current.count;
  }
}
