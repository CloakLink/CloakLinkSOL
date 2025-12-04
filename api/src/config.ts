import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().int().min(1024).max(65535).default(4000),
  DATABASE_URL: z.string().url(),
  ALLOW_ORIGIN: z.string().optional(),
  DEFAULT_PROFILE_ALIAS: z.string().min(2).optional(),
  DEFAULT_RECEIVE_ADDRESS: z.string().min(32).max(44).optional(),
  DEFAULT_CHAIN: z.string().min(2).optional(),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).default(10),
  DATABASE_POOL_TIMEOUT_MS: z.coerce.number().int().min(1000).default(5000),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid API configuration', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

const data = parsed.data;

const config = {
  port: data.PORT,
  databaseUrl: data.DATABASE_URL,
  allowOrigin: data.ALLOW_ORIGIN,
  defaultProfileAlias: data.DEFAULT_PROFILE_ALIAS ?? 'Demo Alias',
  defaultReceiveAddress:
    data.DEFAULT_RECEIVE_ADDRESS ?? 'H3UuEhEDuJeayQM2ngiZX6hgqPdh9vywgqbiZ9erjRzG',
  defaultChain: data.DEFAULT_CHAIN ?? 'solana',
  logLevel: data.LOG_LEVEL,
  dbPoolMax: data.DATABASE_POOL_MAX,
  dbPoolTimeoutMs: data.DATABASE_POOL_TIMEOUT_MS,
} as const;

export { config };
