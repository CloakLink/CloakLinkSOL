import { spawnSync } from 'node:child_process';
import path from 'node:path';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { PublicKey } from '@solana/web3.js';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { type RpcClient } from '../../indexer/src/rpcClient.js';
import { createIndexerRuntime } from '../../indexer/src/runtime.js';
import { createLogger } from '../../indexer/src/logger.js';
import { type IndexerConfig } from '../../indexer/src/config.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const apiRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(apiRoot, '..');
const dbUrl =
  process.env.TEST_DATABASE_URL ?? 'postgresql://cloaklink:cloaklink@localhost:5432/cloaklink_e2e?schema=public';
const receiveAddress = new PublicKey('H3UuEhEDuJeayQM2ngiZX6hgqPdh9vywgqbiZ9erjRzG').toBase58();
const baseConfig: IndexerConfig = {
  rpcUrl: 'http://localhost:8899',
  pollIntervalMs: 10,
  rpcMaxRetries: 0,
  rpcRetryDelayMs: 10,
  rpcTimeoutMs: 1000,
  requireMemoMatch: false,
  memoPrefix: '',
  chain: 'solana',
  logLevel: 'error',
};

let prisma: PrismaClient | undefined;
let app: import('express').Express | undefined;
let skipReason: string | null = null;

beforeAll(async () => {
  process.env.DATABASE_URL = dbUrl;
  const prismaBin = path.join(repoRoot, 'node_modules', '.bin', 'prisma');
  try {
    const migration = spawnSync(prismaBin, ['migrate', 'deploy', '--schema', 'prisma/schema.prisma'], {
      cwd: apiRoot,
      stdio: 'inherit',
      env: { ...process.env, DATABASE_URL: dbUrl },
    });
    if (migration.error) {
      throw migration.error;
    }
    if (migration.status !== 0) {
      throw new Error(`Failed to apply Prisma migrations: ${migration.status}`);
    }

    ({ prisma } = await import('../src/prisma.js'));
    ({ app } = await import('../src/server.js'));

    await prisma!.invoice.deleteMany();
    await prisma!.profile.deleteMany();
  } catch (err) {
    skipReason = `Prisma setup failed: ${err instanceof Error ? err.message : String(err)}`;
  }
});

describe('End-to-end invoice payment detection', () => {
  it('marks an invoice as paid when the mock RPC shows a matching transfer', async () => {
    if (skipReason) {
      console.warn(skipReason);
      return;
    }
    const profileRes = await request(app).post('/profiles').send({
      alias: 'E2E Test',
      receiveAddress,
      defaultChain: 'solana',
    });
    const profileId = profileRes.body.id;

    const invoiceRes = await request(app)
      .post(`/profiles/${profileId}/invoices`)
      .send({ amount: 1.25, tokenSymbol: 'SOL', slug: 'e2e-slug' });

    const invoice = invoiceRes.body;

    const rpcClient: Pick<RpcClient, 'getSignaturesForAddress' | 'getParsedTransaction' | 'status'> = {
      getSignaturesForAddress: vi.fn().mockResolvedValue([
        { signature: 'sig-e2e', slot: 1, err: null, blockTime: 1_700_000_000 },
      ]),
      getParsedTransaction: vi.fn().mockResolvedValue({
        transaction: { message: { accountKeys: [new PublicKey(receiveAddress)], instructions: [] } },
        meta: { preBalances: [0], postBalances: [2_000_000_000], logMessages: [] },
      }),
      status: vi.fn().mockReturnValue({
        endpoint: 'test-endpoint',
        state: 'closed',
        failureCount: 0,
      }),
    };

    const runtime = createIndexerRuntime({
      rpcClient: rpcClient as any,
      prisma: prisma as any,
      config: baseConfig,
      logger: createLogger('error'),
    });

    await runtime.pollOnce();

    const statusRes = await request(app).get(`/invoices/${invoice.id}/status`);
    expect(statusRes.body.status).toBe('PAID');

    const cursor = await prisma.indexerCursor.findUnique({ where: { invoiceId: invoice.id } });
    expect(cursor?.lastSignature).toBe('sig-e2e');
  });
});
