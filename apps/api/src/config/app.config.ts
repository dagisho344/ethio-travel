export type AiProviderName = 'DISABLED' | 'OPENAI_COMPATIBLE';

export interface AppConfig {
  aiApiKey: string;
  aiBaseUrl: string;
  aiMaxOutputTokens: number;
  aiModel: string;
  aiProvider: AiProviderName;
  aiRequestTimeoutMs: number;
  aiRequestsPerHour: number;
  apiPrefix: string;
  corsOrigin: string;
  databaseUrl: string;
  jwtAccessExpiresIn: string;
  jwtAccessSecret: string;
  nodeEnv: 'development' | 'test' | 'production';
  paymentProvider: 'DEVELOPMENT' | 'STRIPE';
  paymentDevelopmentWebhookSecret: string;
  passwordResetTokenExpiresMinutes: number;
  port: number;
  redisUrl: string;
  refreshTokenExpiresDays: number;
}

export const appConfig = (): AppConfig => ({
  aiApiKey: process.env.AI_API_KEY ?? '',
  aiBaseUrl: process.env.AI_BASE_URL ?? '',
  aiMaxOutputTokens: Number(process.env.AI_MAX_OUTPUT_TOKENS ?? 600),
  aiModel: process.env.AI_MODEL ?? 'gpt-4o-mini',
  aiProvider: (process.env.AI_PROVIDER as AiProviderName) ?? 'DISABLED',
  aiRequestTimeoutMs: Number(process.env.AI_REQUEST_TIMEOUT_MS ?? 20_000),
  aiRequestsPerHour: Number(process.env.AI_REQUESTS_PER_HOUR ?? 20),
  apiPrefix: process.env.API_PREFIX ?? 'api/v1',
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
  databaseUrl: process.env.DATABASE_URL ?? '',
  jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET ?? '',
  nodeEnv: (process.env.NODE_ENV as AppConfig['nodeEnv']) ?? 'development',
  paymentProvider:
    (process.env.PAYMENT_PROVIDER as AppConfig['paymentProvider']) ??
    'DEVELOPMENT',
  paymentDevelopmentWebhookSecret:
    process.env.PAYMENT_DEVELOPMENT_WEBHOOK_SECRET ??
    'development-payment-webhook-secret-change-me',
  passwordResetTokenExpiresMinutes: Number(
    process.env.PASSWORD_RESET_TOKEN_EXPIRES_MINUTES ?? 30,
  ),
  port: Number(process.env.PORT ?? 3001),
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
  refreshTokenExpiresDays: Number(process.env.REFRESH_TOKEN_EXPIRES_DAYS ?? 30),
});
