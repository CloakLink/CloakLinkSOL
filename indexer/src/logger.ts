import pino from 'pino';
import { type LogLevel } from './config.js';

const transport =
  process.env.NODE_ENV === 'production'
    ? undefined
    : {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          singleLine: true,
        },
      };

export function createLogger(minLevel: LogLevel, bindings?: Record<string, string>) {
  const logger = pino({
    level: process.env.LOG_LEVEL ?? minLevel,
    base: { service: 'indexer', ...(bindings ?? {}) },
    redact: ['password', 'secret', 'token'],
    serializers: {
      err: pino.stdSerializers.err,
    },
    ...(transport ? { transport } : {}),
  });

  return logger;
}
