import { env, isDevelopment, isProduction, isTest } from './env';

/**
 * Strongly-typed application config derived from validated env.
 * Import this instead of reaching into `process.env` anywhere in the app.
 */
export const config = {
  env: env.NODE_ENV,
  isProduction,
  isDevelopment,
  isTest,

  app: {
    name: env.APP_NAME,
    port: env.PORT,
    host: env.HOST,
    apiPrefix: env.API_PREFIX,
    logLevel: env.LOG_LEVEL,
    corsOrigins: env.CORS_ORIGINS,
  },

  jwt: {
    accessSecret: env.JWT_ACCESS_SECRET,
    refreshSecret: env.JWT_REFRESH_SECRET,
    accessExpiresIn: env.JWT_ACCESS_EXPIRES_IN,
    refreshExpiresIn: env.JWT_REFRESH_EXPIRES_IN,
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE,
  },

  redis: {
    url: env.REDIS_URL,
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD,
    db: env.REDIS_DB,
    tls: env.REDIS_TLS,
  },

  bullmq: {
    prefix: env.BULLMQ_PREFIX,
    concurrency: env.BULLMQ_CONCURRENCY,
  },

  r2: {
    accountId: env.R2_ACCOUNT_ID,
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    bucket: env.R2_BUCKET,
    publicBaseUrl: env.R2_PUBLIC_BASE_URL,
    presignExpiresIn: env.R2_PRESIGN_EXPIRES_IN,
    isConfigured: Boolean(env.R2_ACCOUNT_ID && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY),
  },

  rateLimit: {
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    max: env.RATE_LIMIT_MAX,
  },
} as const;

export type AppConfig = typeof config;
export { env };
