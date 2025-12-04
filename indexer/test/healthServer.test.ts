import { describe, expect, it } from 'vitest';
import { type IndexerConfig } from '../src/config.js';
import { createLogger } from '../src/logger.js';
import { startHealthServer } from '../src/healthServer.js';

describe('health server', () => {
  it('exposes runtime health snapshot', async () => {
    const port = 5600;
    const config = {
      rpcUrl: 'http://endpoint-1',
      rpcEndpoints: ['http://endpoint-1'],
      pollIntervalMs: 1000,
      rpcMaxRetries: 0,
      rpcRetryDelayMs: 10,
      rpcBackoffMaxMs: 50,
      rpcBreakerThreshold: 2,
      rpcBreakerCooldownMs: 1000,
      rpcFailoverThreshold: 1,
      rpcCacheTtlMs: 1000,
      rpcTimeoutMs: 200,
      requireMemoMatch: false,
      memoPrefix: '',
      chain: 'solana',
      logLevel: 'error',
      healthPort: port,
    } satisfies IndexerConfig;

    const runtime = {
      healthSnapshot: () => ({
        lastPollAt: Date.now(),
        lastInvoiceCount: 3,
        skippedDueToCircuit: 0,
        rpc: { endpoint: 'http://endpoint-1', state: 'closed', failureCount: 0 },
      }),
    } as any;

    const stop = startHealthServer(runtime, config, createLogger('error'));
    const res = await fetch(`http://localhost:${port}/health`);
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.rpc.endpoint).toContain('endpoint-1');
    expect(body.lastInvoiceCount).toBe(3);
    stop();
  });
});
