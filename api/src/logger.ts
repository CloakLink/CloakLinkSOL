import pino from 'pino';
import { config } from './config.js';

const level = config.logLevel ?? (process.env.NODE_ENV === 'production' ? 'info' : 'debug');
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

const logger = pino({
  level,
  base: {
    service: 'api',
  },
  ...(transport ? { transport } : {}),
});

export { logger };
