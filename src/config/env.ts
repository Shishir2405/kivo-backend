import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import dotenv from 'dotenv';
import { z } from 'zod';

// Load .env before anything else reads process.env.
dotenv.config();

/**
 * Coerce common truthy/falsey string representations into a boolean.
 */
const booleanString = z
  .enum(['true', 'false', '1', '0', ''])
  .transform((v) => v === 'true' || v === '1')
  .default('false');

const commaSeparated = z
  .string()
  .default('')
  .transform((v) =>
    v
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  );

const envSchema = z
  .object({
    // App
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(8080),
    HOST: z.string().default('0.0.0.0'),
    API_PREFIX: z.string().startsWith('/').default('/api/v1'),
    APP_NAME: z.string().default('Kivo'),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    CORS_ORIGINS: commaSeparated,

    // JWT
    JWT_ACCESS_SECRET: z.string().min(16, 'JWT_ACCESS_SECRET must be at least 16 chars'),
    JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET must be at least 16 chars'),
    JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
    JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),
    JWT_ISSUER: z.string().default('kivo.api'),
    JWT_AUDIENCE: z.string().default('kivo.app'),

    // Firebase
    FIREBASE_SERVICE_ACCOUNT_PATH: z.string().optional(),
    FIREBASE_PROJECT_ID: z.string().optional(),
    FIREBASE_CLIENT_EMAIL: z.string().optional(),
    FIREBASE_PRIVATE_KEY: z.string().optional(),

    // Redis
    REDIS_URL: z.string().optional(),
    REDIS_HOST: z.string().default('127.0.0.1'),
    REDIS_PORT: z.coerce.number().int().positive().default(6379),
    REDIS_PASSWORD: z.string().optional(),
    REDIS_DB: z.coerce.number().int().min(0).default(0),
    REDIS_TLS: booleanString,

    // BullMQ
    BULLMQ_PREFIX: z.string().default('kivo'),
    BULLMQ_CONCURRENCY: z.coerce.number().int().positive().default(10),

    // Cloudflare R2
    R2_ACCOUNT_ID: z.string().optional(),
    R2_ACCESS_KEY_ID: z.string().optional(),
    R2_SECRET_ACCESS_KEY: z.string().optional(),
    R2_BUCKET: z.string().default('kivo-uploads'),
    R2_PUBLIC_BASE_URL: z.string().url().optional(),
    R2_PRESIGN_EXPIRES_IN: z.coerce.number().int().positive().default(900),

    // Rate limiting
    RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
    RATE_LIMIT_MAX: z.coerce.number().int().positive().default(120),
  })
  .superRefine((env, ctx) => {
    // Firebase credentials may come from inline env vars OR a service-account file.
    const hasInline = Boolean(
      env.FIREBASE_PROJECT_ID && env.FIREBASE_CLIENT_EMAIL && env.FIREBASE_PRIVATE_KEY,
    );
    const hasFile = Boolean(
      env.FIREBASE_SERVICE_ACCOUNT_PATH &&
        existsSync(path.resolve(env.FIREBASE_SERVICE_ACCOUNT_PATH)),
    );

    // Allow boot without Firebase in test so unit tests don't need real creds.
    if (env.NODE_ENV !== 'test' && !hasInline && !hasFile) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'Firebase credentials missing: provide FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + ' +
          'FIREBASE_PRIVATE_KEY, or a valid FIREBASE_SERVICE_ACCOUNT_PATH.',
        path: ['FIREBASE_PROJECT_ID'],
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  • ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    // Logger isn't available this early; fail loud and exit.
    // eslint-disable-next-line no-console
    console.error(`\n❌ Invalid environment configuration:\n${issues}\n`);
    process.exit(1);
  }

  return parsed.data;
}

export const env = loadEnv();

export const isProduction = env.NODE_ENV === 'production';
export const isDevelopment = env.NODE_ENV === 'development';
export const isTest = env.NODE_ENV === 'test';

/**
 * Resolve Firebase service-account credentials from inline env vars or a JSON file.
 * Returns `null` in test when no credentials are configured.
 */
export function resolveFirebaseCredentials():
  | { projectId: string; clientEmail: string; privateKey: string }
  | null {
  if (env.FIREBASE_PROJECT_ID && env.FIREBASE_CLIENT_EMAIL && env.FIREBASE_PRIVATE_KEY) {
    return {
      projectId: env.FIREBASE_PROJECT_ID,
      clientEmail: env.FIREBASE_CLIENT_EMAIL,
      // Support keys stored with literal "\n" sequences.
      privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    };
  }

  if (env.FIREBASE_SERVICE_ACCOUNT_PATH) {
    const resolved = path.resolve(env.FIREBASE_SERVICE_ACCOUNT_PATH);
    if (existsSync(resolved)) {
      const raw = JSON.parse(readFileSync(resolved, 'utf-8')) as {
        project_id: string;
        client_email: string;
        private_key: string;
      };
      return {
        projectId: raw.project_id,
        clientEmail: raw.client_email,
        privateKey: raw.private_key,
      };
    }
  }

  return null;
}
