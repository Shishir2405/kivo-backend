import pino, { type LoggerOptions } from 'pino';

import { config } from '@/config';

/**
 * Centralised structured logger.
 *
 * - Pretty, colourised output in development.
 * - JSON (machine-parseable) in production for log aggregation.
 * - Secrets are redacted defensively.
 */
const baseOptions: LoggerOptions = {
  level: config.app.logLevel,
  base: { service: 'kivo-backend', env: config.env },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'password',
      '*.password',
      'token',
      '*.token',
      'privateKey',
      '*.privateKey',
      'secret',
      '*.secret',
    ],
    censor: '[REDACTED]',
  },
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
};

const transport =
  config.isDevelopment && !config.isTest
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:HH:MM:ss.l',
          ignore: 'pid,hostname,service,env',
          singleLine: false,
        },
      }
    : undefined;

export const logger = pino({ ...baseOptions, ...(transport ? { transport } : {}) });

/**
 * Create a child logger bound to a contextual scope (e.g. a module or job name),
 * so every line carries `{ context: '...' }`.
 */
export function createLogger(context: string) {
  return logger.child({ context });
}

export type Logger = typeof logger;
