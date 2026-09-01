export interface AppConfig {
  apiPrefix: string;
  corsOrigin: string;
  databaseUrl: string;
  jwtAccessExpiresIn: string;
  jwtAccessSecret: string;
  nodeEnv: 'development' | 'test' | 'production';
  passwordResetTokenExpiresMinutes: number;
  port: number;
  redisUrl: string;
  refreshTokenExpiresDays: number;
}

export const appConfig = (): AppConfig => ({
  apiPrefix: process.env.API_PREFIX ?? 'api/v1',
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
  databaseUrl: process.env.DATABASE_URL ?? '',
  jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET ?? '',
  nodeEnv: (process.env.NODE_ENV as AppConfig['nodeEnv']) ?? 'development',
  passwordResetTokenExpiresMinutes: Number(
    process.env.PASSWORD_RESET_TOKEN_EXPIRES_MINUTES ?? 30,
  ),
  port: Number(process.env.PORT ?? 3001),
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
  refreshTokenExpiresDays: Number(process.env.REFRESH_TOKEN_EXPIRES_DAYS ?? 30),
});
