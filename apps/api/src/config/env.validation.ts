import Joi from 'joi';

export const envValidationSchema = Joi.object({
  AI_API_KEY: Joi.when('AI_PROVIDER', {
    is: 'OPENAI_COMPATIBLE',
    then: Joi.string().min(1).required(),
    otherwise: Joi.string().allow('').optional(),
  }),
  AI_BASE_URL: Joi.when('AI_PROVIDER', {
    is: 'OPENAI_COMPATIBLE',
    then: Joi.string()
      .uri({ scheme: ['http', 'https'] })
      .required(),
    otherwise: Joi.string().allow('').optional(),
  }),
  AI_MAX_OUTPUT_TOKENS: Joi.number().integer().min(64).max(2048).default(600),
  AI_MODEL: Joi.string().max(160).default('gpt-4o-mini'),
  AI_PROVIDER: Joi.string()
    .valid('DISABLED', 'OPENAI_COMPATIBLE')
    .default('DISABLED'),
  AI_REQUEST_TIMEOUT_MS: Joi.number()
    .integer()
    .min(1000)
    .max(60000)
    .default(20000),
  AI_REQUESTS_PER_HOUR: Joi.number().integer().min(1).max(100).default(20),
  API_PREFIX: Joi.string().default('api/v1'),
  CORS_ORIGIN: Joi.string().uri().default('http://localhost:3000'),
  DATABASE_URL: Joi.string()
    .uri({ scheme: ['postgresql', 'postgres'] })
    .required(),
  JWT_ACCESS_EXPIRES_IN: Joi.string().default('15m'),
  JWT_ACCESS_SECRET: Joi.string().min(32).required(),
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),
  PAYMENT_PROVIDER: Joi.string()
    .valid('DEVELOPMENT', 'STRIPE')
    .default('DEVELOPMENT'),
  PAYMENT_DEVELOPMENT_WEBHOOK_SECRET: Joi.when('PAYMENT_PROVIDER', {
    is: 'DEVELOPMENT',
    then: Joi.string()
      .min(32)
      .default('development-payment-webhook-secret-change-me'),
    otherwise: Joi.string().optional(),
  }),
  PASSWORD_RESET_TOKEN_EXPIRES_MINUTES: Joi.number()
    .integer()
    .min(5)
    .default(30),
  PORT: Joi.number().port().default(3001),
  REDIS_URL: Joi.string()
    .uri({ scheme: ['redis', 'rediss'] })
    .required(),
  REFRESH_TOKEN_EXPIRES_DAYS: Joi.number().integer().min(1).default(30),
});
