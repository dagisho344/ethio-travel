process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET =
  'test-secret-with-at-least-thirty-two-characters';
process.env.DATABASE_URL =
  process.env.DATABASE_URL ??
  'postgresql://ethiotravel:ethiotravel@localhost:5432/ethiotravel?schema=public';
process.env.REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
