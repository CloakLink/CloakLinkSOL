import { clusterApiUrl } from '@solana/web3.js';
import { z } from 'zod';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const envSchema = z.object({
  RPC_URL: z.string().url(),
  POLL_INTERVAL_MS: z.coerce.number().int().positive().default(15000),
  RPC_MAX_RETRIES: z.coerce.number().int().min(0).default(3),
  RPC_RETRY_DELAY_MS: z.coerce.number().int().min(100).default(1000),
  RPC_TIMEOUT_MS: z.coerce.number().int().min(500).default(15000),
  REQUIRE_MEMO_MATCH: z.coerce.boolean().default(false),
  INVOICE_MEMO_PREFIX: z.string().default(''),
  CHAIN: z.string().default('solana'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

export type IndexerConfig = {
  rpcUrl: string;
  pollIntervalMs: number;
  rpcMaxRetries: number;
  rpcRetryDelayMs: number;
  rpcTimeoutMs: number;
  requireMemoMatch: boolean;
  memoPrefix: string;
  chain: string;
  logLevel: LogLevel;
};

export function loadConfig(): IndexerConfig {
  const parsed = envSchema.safeParse({
    RPC_URL: process.env.RPC_URL ?? clusterApiUrl('mainnet-beta'),
    POLL_INTERVAL_MS: process.env.POLL_INTERVAL_MS,
    RPC_MAX_RETRIES: process.env.RPC_MAX_RETRIES,
    RPC_RETRY_DELAY_MS: process.env.RPC_RETRY_DELAY_MS,
    RPC_TIMEOUT_MS: process.env.RPC_TIMEOUT_MS,
    REQUIRE_MEMO_MATCH: process.env.REQUIRE_MEMO_MATCH,
    INVOICE_MEMO_PREFIX: process.env.INVOICE_MEMO_PREFIX,
    CHAIN: process.env.CHAIN,
    LOG_LEVEL: process.env.LOG_LEVEL,
  });

  if (!parsed.success) {
    console.error('Invalid indexer configuration', parsed.error.flatten().fieldErrors);
    process.exit(1);
  }

  const data = parsed.data;
  return {
    rpcUrl: data.RPC_URL,
    pollIntervalMs: data.POLL_INTERVAL_MS,
    rpcMaxRetries: data.RPC_MAX_RETRIES,
    rpcRetryDelayMs: data.RPC_RETRY_DELAY_MS,
    rpcTimeoutMs: data.RPC_TIMEOUT_MS,
    requireMemoMatch: data.REQUIRE_MEMO_MATCH,
    memoPrefix: data.INVOICE_MEMO_PREFIX,
    chain: data.CHAIN,
    logLevel: data.LOG_LEVEL,
  };
}
