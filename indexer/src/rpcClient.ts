import { Connection, PublicKey, type ParsedTransactionWithMeta } from '@solana/web3.js';
import { type IndexerConfig } from './config.js';
import { type createLogger } from './logger.js';
import { rpcRequestDuration, rpcRequestsTotal } from './metrics.js';

const JITTER_RATIO = 0.1;

type Logger = ReturnType<typeof createLogger>;
type CircuitState = 'closed' | 'open' | 'half-open';
export type RpcStatus = {
  endpoint: string;
  state: CircuitState;
  failureCount: number;
  openUntil?: number;
  lastError?: string;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, actionName: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`RPC ${actionName} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timeout);
        resolve(value);
      })
      .catch((err) => {
        clearTimeout(timeout);
        reject(err);
      });
  });
}

export class RpcClient {
  private readonly endpoints: string[];
  private connection: Connection;
  private endpointIndex = 0;
  private failureCount = 0;
  private state: CircuitState = 'closed';
  private openUntil = 0;
  private lastError?: string;
  private readonly transactionCache = new Map<string, { expiresAt: number; value: ParsedTransactionWithMeta | null }>();

  constructor(
    private readonly config: IndexerConfig,
    private readonly logger: Logger,
    private readonly connectionFactory: (endpoint: string) => Connection = (endpoint) =>
      new Connection(endpoint, 'confirmed')
  ) {
    if (config.rpcEndpoints.length === 0) {
      throw new Error('At least one RPC endpoint must be configured');
    }

    this.endpoints = config.rpcEndpoints;
    this.buildConnection(this.endpoints[0]);
  }

  private buildConnection(endpoint: string) {
    this.logger.info('Connecting to Solana RPC', { endpoint });
    this.connection = this.connectionFactory(endpoint);
  }

  private get currentEndpoint() {
    return this.endpoints[this.endpointIndex];
  }

  private markSuccess() {
    if (this.failureCount > 0 || this.state !== 'closed') {
      this.logger.info('RPC circuit closed', { failures: this.failureCount, endpoint: this.currentEndpoint });
    }
    this.failureCount = 0;
    this.state = 'closed';
    this.openUntil = 0;
    this.lastError = undefined;
  }

  private markFailure(error: unknown) {
    this.lastError = error instanceof Error ? error.message : String(error);
    if (this.state === 'half-open') {
      this.state = 'open';
      this.openUntil = Date.now() + this.config.rpcBreakerCooldownMs;
      this.logger.error('RPC circuit reopened after failed half-open probe', {
        endpoint: this.currentEndpoint,
        lastError: this.lastError,
      });
      return;
    }

    this.failureCount += 1;
    if (this.failureCount >= this.config.rpcBreakerThreshold) {
      this.state = 'open';
      this.openUntil = Date.now() + this.config.rpcBreakerCooldownMs;
      this.logger.error('RPC circuit opened', {
        failures: this.failureCount,
        endpoint: this.currentEndpoint,
        reopenAt: this.openUntil,
        lastError: this.lastError,
      });
    }
  }

  private assertReady() {
    if (this.state === 'open') {
      if (Date.now() < this.openUntil) {
        throw new Error('RPC circuit open');
      }
      this.state = 'half-open';
    }
  }

  private shouldRotateEndpoint() {
    return this.endpoints.length > 1 && this.failureCount % this.config.rpcFailoverThreshold === 0;
  }

  private rotateEndpoint() {
    if (this.endpoints.length <= 1) return;

    const previousEndpoint = this.currentEndpoint;
    this.endpointIndex = (this.endpointIndex + 1) % this.endpoints.length;
    this.buildConnection(this.currentEndpoint);
    this.logger.warn('Rotated RPC endpoint after failures', {
      previousEndpoint,
      endpoint: this.currentEndpoint,
      failures: this.failureCount,
    });
  }

  private async execute<T>(actionName: string, operation: (connection: Connection) => Promise<T>): Promise<T> {
    this.assertReady();
    let delay = this.config.rpcRetryDelayMs;
    let lastError: unknown;

    for (let attempt = 0; attempt <= this.config.rpcMaxRetries; attempt++) {
      const endpoint = this.currentEndpoint;
      const endTimer = rpcRequestDuration.startTimer({ method: actionName, endpoint });
      try {
        const result = await withTimeout(operation(this.connection), this.config.rpcTimeoutMs, actionName);
        this.markSuccess();
        rpcRequestsTotal.inc({ method: actionName, endpoint, outcome: 'success' });
        endTimer({ outcome: 'success' });
        return result;
      } catch (err) {
        lastError = err;
        this.markFailure(err);
        rpcRequestsTotal.inc({ method: actionName, endpoint, outcome: 'error' });
        endTimer({ outcome: 'error' });
        if (attempt === this.config.rpcMaxRetries) break;
        this.logger.warn({
          err,
          action: actionName,
          endpoint: this.currentEndpoint,
          attempt: attempt + 1,
        }, 'RPC call failed');
        if (this.shouldRotateEndpoint()) {
          this.rotateEndpoint();
        }
        const waitMs = Math.min(delay, this.config.rpcBackoffMaxMs);
        const jitter = Math.floor(waitMs * JITTER_RATIO * Math.random());
        await sleep(waitMs + jitter);
        delay = Math.min(delay * 2, this.config.rpcBackoffMaxMs);
      }
    }

    throw lastError instanceof Error ? lastError : new Error('RPC request failed');
  }

  async getSignaturesForAddress(address: PublicKey, options?: Parameters<Connection['getSignaturesForAddress']>[1]) {
    return this.execute('getSignaturesForAddress', (conn) => conn.getSignaturesForAddress(address, options));
  }

  async getParsedTransaction(signature: string, options?: Parameters<Connection['getParsedTransaction']>[1]) {
    const cached = this.transactionCache.get(signature);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    const tx = await this.execute('getParsedTransaction', (conn) => conn.getParsedTransaction(signature, options));
    this.transactionCache.set(signature, { value: tx, expiresAt: Date.now() + this.config.rpcCacheTtlMs });
    return tx;
  }

  status(): RpcStatus {
    return {
      endpoint: this.currentEndpoint,
      state: this.state,
      failureCount: this.failureCount,
      openUntil: this.openUntil || undefined,
      lastError: this.lastError,
    };
  }
}
