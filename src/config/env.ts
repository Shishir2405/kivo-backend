import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import dotenv from 'dotenv';
import { z } from 'zod';

// Load .env before anything else reads process.env.
dotenv.config();

/**
 * Serverless runtimes (Vercel) instantiate the app per-invocation and have no
 * persistent process to keep alive. We must never `process.exit()` there — doing
 * so turns a recoverable mis-config into a hard `FUNCTION_INVOCATION_FAILED` crash.
 * Instead we fall back to safe defaults and let the function boot so `/health`
 * and clean per-route 503s still work.
 */
const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

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

    // JWT — optional at the schema level so a mis-configured serverless deploy
    // can still boot and serve `/health`; enforced as required below for
    // persistent hosts (see `loadEnv`). Auth routes fail cleanly without them.
    JWT_ACCESS_SECRET: z.string().min(16, 'JWT_ACCESS_SECRET must be at least 16 chars').optional(),
    JWT_REFRESH_SECRET: z
      .string()
      .min(16, 'JWT_REFRESH_SECRET must be at least 16 chars')
      .optional(),
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
  });

/**
 * True when Firebase Admin credentials are available, either as inline env vars
 * or as a readable service-account JSON file. Firebase is initialised lazily on
 * first use, so the app boots without it and Firestore-backed routes return a
 * clean 503 until it is configured.
 */
export function isFirebaseConfigured(): boolean {
  const e = process.env;
  const hasInline = Boolean(
    e.FIREBASE_PROJECT_ID && e.FIREBASE_CLIENT_EMAIL && e.FIREBASE_PRIVATE_KEY,
  );
  const hasFile = Boolean(
    e.FIREBASE_SERVICE_ACCOUNT_PATH && existsSync(path.resolve(e.FIREBASE_SERVICE_ACCOUNT_PATH)),
  );
  return hasInline || hasFile;
}

export type Env = z.infer<typeof envSchema>;

/**
 * Last-resort JWT secret used ONLY when none is configured on a serverless deploy,
 * so the function can boot and serve `/health`. Tokens signed with this are not
 * portable across cold starts/instances, so auth is effectively disabled until
 * real secrets are set — which is the intended, fail-safe (not fail-crash) behaviour.
 */
const EPHEMERAL_JWT_FALLBACK = 'kivo-unconfigured-ephemeral-secret-set-real-secrets';

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);

  if (parsed.success) {
    warnOnMissingSecrets(parsed.data);
    return parsed.data;
  }

  const issues = parsed.error.issues
    .map((i) => `  • ${i.path.join('.') || '(root)'}: ${i.message}`)
    .join('\n');

  // On a persistent host a bad config should fail loud so it's caught in deploy.
  // On serverless we must keep booting — exiting yields FUNCTION_INVOCATION_FAILED
  // and the function can never serve `/health`. Fall back to schema defaults.
  if (!isServerless) {
    // eslint-disable-next-line no-console
    console.error(`\n❌ Invalid environment configuration:\n${issues}\n`);
    process.exit(1);
  }

  // eslint-disable-next-line no-console
  console.warn(
    `\n⚠️  Invalid environment configuration (serverless — booting with defaults):\n${issues}\n`,
  );
  // Re-parse with defaults applied; required fields fall through to undefined and
  // are patched below.
  const fallback = envSchema.partial().safeParse(process.env);
  const data = (fallback.success ? fallback.data : {}) as Partial<Env>;
  const resolved = { ...envSchema.parse({}), ...data } as Env;
  warnOnMissingSecrets(resolved);
  return resolved;
}

function warnOnMissingSecrets(e: Env): void {
  const missing: string[] = [];
  if (!e.JWT_ACCESS_SECRET) missing.push('JWT_ACCESS_SECRET');
  if (!e.JWT_REFRESH_SECRET) missing.push('JWT_REFRESH_SECRET');
  if (missing.length > 0) {
    // eslint-disable-next-line no-console
    console.warn(
      `⚠️  Missing secrets [${missing.join(', ')}] — using an ephemeral fallback so the ` +
        `service can boot. Authentication will NOT work until these are set in the environment.`,
    );
  }
}

const rawEnv = loadEnv();

/**
 * Final config. JWT secrets are guaranteed non-empty strings here (real values on
 * a correctly configured deploy, an ephemeral fallback otherwise) so downstream
 * signing code keeps a `string` contract and never needs null checks.
 */
export const env: Env & { JWT_ACCESS_SECRET: string; JWT_REFRESH_SECRET: string } = {
  ...rawEnv,
  JWT_ACCESS_SECRET: rawEnv.JWT_ACCESS_SECRET ?? EPHEMERAL_JWT_FALLBACK,
  JWT_REFRESH_SECRET: rawEnv.JWT_REFRESH_SECRET ?? EPHEMERAL_JWT_FALLBACK,
};

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
