import { PublicKey } from '@solana/web3.js';
import { describe, expect, it, vi } from 'vitest';
import { type IndexerConfig } from '../src/config.js';
import { createLogger } from '../src/logger.js';
import { RpcClient } from '../src/rpcClient.js';

const baseConfig: IndexerConfig = {
  rpcUrl: 'http://endpoint-1',
  rpcEndpoints: ['http://endpoint-1', 'http://endpoint-2'],
  pollIntervalMs: 1000,
  rpcMaxRetries: 1,
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
  healthPort: 5001,
};

const dummyAddress = new PublicKey('H3UuEhEDuJeayQM2ngiZX6hgqPdh9vywgqbiZ9erjRzG');

function buildConnection(endpoint: string) {
  const tx = { endpoint };
  return {
    endpoint,
    getSignaturesForAddress: vi.fn().mockRejectedValue(new Error(`fail-${endpoint}`)),
    getParsedTransaction: vi.fn().mockResolvedValue(tx),
  };
}

describe('RpcClient', () => {
  it('opens the circuit after repeated failures', async () => {
    vi.useFakeTimers();
    const connection = buildConnection(baseConfig.rpcUrl);
    const client = new RpcClient(
      { ...baseConfig, rpcEndpoints: [baseConfig.rpcUrl], rpcBreakerThreshold: 1, rpcFailoverThreshold: 2 },
      createLogger('error'),
      () => connection as any
    );

    const failingCall = client.getSignaturesForAddress(dummyAddress).catch((err) => err);
    await vi.runAllTimersAsync();
    const error = await failingCall;
    expect(error).toBeInstanceOf(Error);

    const status = client.status();
    expect(status.state).toBe('open');
    expect(status.failureCount).toBeGreaterThanOrEqual(1);
    expect(status.lastError).toContain('fail-');
    vi.useRealTimers();
  });

  it('rotates endpoints and succeeds on a healthy host', async () => {
    vi.useFakeTimers();
    const firstConnection = buildConnection('http://endpoint-1');
    const secondConnection = buildConnection('http://endpoint-2');
    secondConnection.getSignaturesForAddress.mockResolvedValue([]);

    const connectionFactory = vi
      .fn()
      .mockImplementationOnce(() => firstConnection as any)
      .mockImplementationOnce(() => secondConnection as any);

    const client = new RpcClient(baseConfig, createLogger('error'), connectionFactory as any);

    const resultPromise = client.getSignaturesForAddress(dummyAddress);
    await vi.runAllTimersAsync();
    await expect(resultPromise).resolves.toEqual([]);
    expect(connectionFactory).toHaveBeenCalledTimes(2);
    expect(client.status().endpoint).toBe('http://endpoint-2');
    vi.useRealTimers();
  });

  it('returns cached parsed transactions within TTL', async () => {
    vi.useFakeTimers();
    const connection = buildConnection(baseConfig.rpcUrl);
    const client = new RpcClient({ ...baseConfig, rpcEndpoints: [baseConfig.rpcUrl] }, createLogger('error'), () => connection as any);

    const firstPromise = client.getParsedTransaction('sig-1');
    await vi.runAllTimersAsync();
    const first = await firstPromise;
    const secondPromise = client.getParsedTransaction('sig-1');
    await vi.runAllTimersAsync();
    const second = await secondPromise;
    expect(first).toBe(second);
    expect(connection.getParsedTransaction).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(baseConfig.rpcCacheTtlMs + 10);
    await vi.runAllTimersAsync();
    const thirdPromise = client.getParsedTransaction('sig-1');
    await vi.runAllTimersAsync();
    await thirdPromise;
    expect(connection.getParsedTransaction).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });
});
