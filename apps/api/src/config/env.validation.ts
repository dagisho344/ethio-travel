import Joi from 'joi';

export const envValidationSchema = Joi.object({
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
