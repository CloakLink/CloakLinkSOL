import { Prisma, type Invoice, type IndexerCursor } from '@prisma/client';
import { PublicKey } from '@solana/web3.js';
import { describe, expect, it, vi } from 'vitest';
import { type IndexerConfig } from '../src/config.js';
import { createLogger } from '../src/logger.js';
import { createIndexerRuntime } from '../src/runtime.js';

const baseConfig: IndexerConfig = {
  rpcUrl: 'http://localhost:8899',
  pollIntervalMs: 10,
  rpcMaxRetries: 0,
  rpcRetryDelayMs: 10,
  rpcTimeoutMs: 1000,
  requireMemoMatch: false,
  memoPrefix: 'memo-',
  chain: 'solana',
  logLevel: 'error',
};

const receiveAddress = new PublicKey('H3UuEhEDuJeayQM2ngiZX6hgqPdh9vywgqbiZ9erjRzG').toBase58();

function buildInvoice(overrides: Partial<Invoice & { cursor: IndexerCursor | null }> = {}) {
  const base: Invoice & { cursor: IndexerCursor | null } = {
    id: 'invoice-1',
    profileId: 'profile-1',
    amount: new Prisma.Decimal(1),
    tokenSymbol: 'SOL',
    tokenAddress: null,
    tokenDecimals: null,
    chain: 'solana',
    receiveAddress,
    description: null,
    slug: 'test-slug',
    status: 'PENDING',
    txHash: null,
    paidAt: null,
    expiresAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    cursor: null,
  } as Invoice & { cursor: IndexerCursor | null };
  return { ...base, ...overrides };
}

describe('Indexer runtime', () => {
  it('detects SOL payments with memo when required', async () => {
    const prisma = {
      invoice: { update: vi.fn(), findMany: vi.fn() },
      indexerCursor: { upsert: vi.fn() },
    } as unknown as Parameters<typeof createIndexerRuntime>[0]['prisma'];

    const parsedTx = {
      transaction: {
        message: {
          accountKeys: [new PublicKey(receiveAddress)],
          instructions: [{ parsed: { info: { memo: 'memo-test-slug' } } }],
        },
      },
      meta: {
        preBalances: [0],
        postBalances: [2_000_000_000],
        logMessages: [],
      },
    } as any;

    const connection = {
      getParsedTransaction: vi.fn().mockResolvedValue(parsedTx),
      getSignaturesForAddress: vi.fn(),
    } as unknown as Parameters<typeof createIndexerRuntime>[0]['connection'];

    const runtime = createIndexerRuntime({
      connection,
      prisma,
      config: { ...baseConfig, requireMemoMatch: true },
      logger: createLogger('error'),
    });

    const invoice = buildInvoice({ slug: 'test-slug' });
    const matched = await runtime.processSignature(invoice, 'sig-1');
    expect(matched).toBe(true);
  });

  it('marks invoices paid and advances cursor using newest signature', async () => {
    const invoice = buildInvoice();
    const prisma = {
      invoice: {
        findMany: vi.fn().mockResolvedValue([invoice]),
        update: vi.fn().mockResolvedValue({ ...invoice, status: 'PAID' }),
      },
      indexerCursor: { upsert: vi.fn() },
    } as unknown as Parameters<typeof createIndexerRuntime>[0]['prisma'];

    const parsedTx = {
      transaction: { message: { accountKeys: [new PublicKey(receiveAddress)], instructions: [] } },
      meta: { preBalances: [0], postBalances: [2_000_000_000], logMessages: [] },
    } as any;

    const connection = {
      getParsedTransaction: vi.fn().mockResolvedValue(parsedTx),
      getSignaturesForAddress: vi.fn().mockResolvedValue([
        { signature: 'sig-newest', slot: 1, err: null, blockTime: 1_700_000_000 },
        { signature: 'sig-old', slot: 0, err: null, blockTime: 1_699_000_000 },
      ]),
    } as unknown as Parameters<typeof createIndexerRuntime>[0]['connection'];

    const runtime = createIndexerRuntime({
      connection,
      prisma,
      config: baseConfig,
      logger: createLogger('error'),
    });

    await runtime.pollOnce();

    expect(prisma.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: invoice.id },
        data: expect.objectContaining({ status: 'PAID', txHash: 'sig-old' }),
      })
    );
    expect(prisma.indexerCursor.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { invoiceId: invoice.id },
        update: { lastSignature: 'sig-newest' },
        create: { invoiceId: invoice.id, lastSignature: 'sig-newest' },
      })
    );
  });

  it('detects SPL token transfers using token balance deltas', async () => {
    const splInvoice = buildInvoice({ tokenAddress: 'TestMint11111111111111111111111111111111111', tokenSymbol: 'USDC' });

    const prisma = {
      invoice: { findMany: vi.fn().mockResolvedValue([splInvoice]), update: vi.fn() },
      indexerCursor: { upsert: vi.fn() },
    } as unknown as Parameters<typeof createIndexerRuntime>[0]['prisma'];

    const parsedTx = {
      transaction: { message: { accountKeys: [new PublicKey(receiveAddress)], instructions: [] } },
      meta: {
        preTokenBalances: [
          {
            owner: receiveAddress,
            mint: splInvoice.tokenAddress,
            uiTokenAmount: { uiAmountString: '0', uiAmount: 0, decimals: 6 },
          },
        ],
        postTokenBalances: [
          {
            owner: receiveAddress,
            mint: splInvoice.tokenAddress,
            uiTokenAmount: { uiAmountString: '5', uiAmount: 5, decimals: 6 },
          },
        ],
        logMessages: [],
      },
    } as any;

    const connection = {
      getParsedTransaction: vi.fn().mockResolvedValue(parsedTx),
      getSignaturesForAddress: vi.fn().mockResolvedValue([{ signature: 'sig', slot: 1, err: null, blockTime: null }]),
    } as unknown as Parameters<typeof createIndexerRuntime>[0]['connection'];

    const runtime = createIndexerRuntime({
      connection,
      prisma,
      config: baseConfig,
      logger: createLogger('error'),
    });

    await runtime.checkInvoice(splInvoice);

    expect(prisma.invoice.update).toHaveBeenCalled();
    expect(prisma.indexerCursor.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { invoiceId: splInvoice.id },
        update: { lastSignature: 'sig' },
      })
    );
  });
});
