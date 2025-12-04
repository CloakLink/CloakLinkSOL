import { clusterApiUrl } from '@solana/web3.js';
import { z } from 'zod';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const envSchema = z.object({
  RPC_URL: z.string().url(),
  RPC_ENDPOINTS: z.string().optional(),
  POLL_INTERVAL_MS: z.coerce.number().int().positive().default(15000),
  RPC_MAX_RETRIES: z.coerce.number().int().min(0).default(3),
  RPC_RETRY_DELAY_MS: z.coerce.number().int().min(100).default(1000),
  RPC_BACKOFF_MAX_MS: z.coerce.number().int().min(1000).default(30000),
  RPC_BREAKER_THRESHOLD: z.coerce.number().int().min(1).default(5),
  RPC_BREAKER_COOLDOWN_MS: z.coerce.number().int().min(1000).default(30000),
  RPC_FAILOVER_THRESHOLD: z.coerce.number().int().min(1).default(3),
  RPC_CACHE_TTL_MS: z.coerce.number().int().min(1000).default(30000),
  RPC_TIMEOUT_MS: z.coerce.number().int().min(500).default(15000),
  REQUIRE_MEMO_MATCH: z.coerce.boolean().default(false),
  INVOICE_MEMO_PREFIX: z.string().default(''),
  CHAIN: z.string().default('solana'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  HEALTH_PORT: z.coerce.number().int().min(1024).max(65535).default(5001),
});

export type IndexerConfig = {
  rpcUrl: string;
  pollIntervalMs: number;
  rpcMaxRetries: number;
  rpcRetryDelayMs: number;
  rpcBackoffMaxMs: number;
  rpcBreakerThreshold: number;
  rpcBreakerCooldownMs: number;
  rpcFailoverThreshold: number;
  rpcCacheTtlMs: number;
  rpcTimeoutMs: number;
  requireMemoMatch: boolean;
  memoPrefix: string;
  chain: string;
  logLevel: LogLevel;
  rpcEndpoints: string[];
  healthPort: number;
};

export function loadConfig(): IndexerConfig {
  const parsed = envSchema.safeParse({
    RPC_URL: process.env.RPC_URL ?? clusterApiUrl('mainnet-beta'),
    RPC_ENDPOINTS: process.env.RPC_ENDPOINTS,
    POLL_INTERVAL_MS: process.env.POLL_INTERVAL_MS,
    RPC_MAX_RETRIES: process.env.RPC_MAX_RETRIES,
    RPC_RETRY_DELAY_MS: process.env.RPC_RETRY_DELAY_MS,
    RPC_BACKOFF_MAX_MS: process.env.RPC_BACKOFF_MAX_MS,
    RPC_BREAKER_THRESHOLD: process.env.RPC_BREAKER_THRESHOLD,
    RPC_BREAKER_COOLDOWN_MS: process.env.RPC_BREAKER_COOLDOWN_MS,
    RPC_FAILOVER_THRESHOLD: process.env.RPC_FAILOVER_THRESHOLD,
    RPC_TIMEOUT_MS: process.env.RPC_TIMEOUT_MS,
    RPC_CACHE_TTL_MS: process.env.RPC_CACHE_TTL_MS,
    REQUIRE_MEMO_MATCH: process.env.REQUIRE_MEMO_MATCH,
    INVOICE_MEMO_PREFIX: process.env.INVOICE_MEMO_PREFIX,
    CHAIN: process.env.CHAIN,
    LOG_LEVEL: process.env.LOG_LEVEL,
    HEALTH_PORT: process.env.HEALTH_PORT,
  });

  if (!parsed.success) {
    console.error('Invalid indexer configuration', parsed.error.flatten().fieldErrors);
    process.exit(1);
  }

  const data = parsed.data;
  const endpoints = (data.RPC_ENDPOINTS ?? data.RPC_URL)
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean);

  return {
    rpcUrl: data.RPC_URL,
    rpcEndpoints: endpoints,
    pollIntervalMs: data.POLL_INTERVAL_MS,
    rpcMaxRetries: data.RPC_MAX_RETRIES,
    rpcRetryDelayMs: data.RPC_RETRY_DELAY_MS,
    rpcBackoffMaxMs: data.RPC_BACKOFF_MAX_MS,
    rpcBreakerThreshold: data.RPC_BREAKER_THRESHOLD,
    rpcBreakerCooldownMs: data.RPC_BREAKER_COOLDOWN_MS,
    rpcFailoverThreshold: data.RPC_FAILOVER_THRESHOLD,
    rpcCacheTtlMs: data.RPC_CACHE_TTL_MS,
    rpcTimeoutMs: data.RPC_TIMEOUT_MS,
    requireMemoMatch: data.REQUIRE_MEMO_MATCH,
    memoPrefix: data.INVOICE_MEMO_PREFIX,
    chain: data.CHAIN,
    logLevel: data.LOG_LEVEL,
    healthPort: data.HEALTH_PORT,
  };
}
