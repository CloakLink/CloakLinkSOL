import { Prisma, type PrismaClient, type IndexerCursor, type Invoice } from '@prisma/client';
import { LAMPORTS_PER_SOL, PublicKey, type ParsedTransactionWithMeta } from '@solana/web3.js';
import { type IndexerConfig } from './config.js';
import { type createLogger } from './logger.js';
import { RpcClient } from './rpcClient.js';

type Logger = ReturnType<typeof createLogger>;

export type IndexerDependencies = {
  rpcClient: Pick<RpcClient, 'getSignaturesForAddress' | 'getParsedTransaction' | 'status'>;
  prisma: Pick<PrismaClient, 'invoice' | 'indexerCursor'>;
  config: IndexerConfig;
  logger: Logger;
};

function findAccountIndex(tx: ParsedTransactionWithMeta, address: string) {
  return tx.transaction.message.accountKeys.findIndex((key) =>
    'pubkey' in key ? key.pubkey.toBase58() === address : key.toBase58() === address
  );
}

function getSolIncrease(tx: ParsedTransactionWithMeta, address: string) {
  const accountIndex = findAccountIndex(tx, address);
  if (accountIndex === -1) return 0;
  const pre = tx.meta?.preBalances?.[accountIndex] ?? 0;
  const post = tx.meta?.postBalances?.[accountIndex] ?? 0;
  const delta = post - pre;
  return delta / LAMPORTS_PER_SOL;
}

type TokenIncrease = { mint: string; amount: number };

function extractMemos(tx: ParsedTransactionWithMeta) {
  const parsedMemos = tx.transaction.message.instructions
    .map((ix) => {
      if (!('parsed' in ix)) return null;
      const parsedInstruction = ix.parsed as { info?: { memo?: string } };
      return parsedInstruction.info?.memo ?? null;
    })
    .filter((val): val is string => Boolean(val));

  const logMemos = (tx.meta?.logMessages ?? [])
    .map((msg) => msg.replace('Program log: ', ''))
    .filter((msg) => msg.length > 0);

  return [...parsedMemos, ...logMemos];
}

function getSplIncreases(tx: ParsedTransactionWithMeta, owner: string): TokenIncrease[] {
  const postBalances = tx.meta?.postTokenBalances ?? [];
  const preBalances = tx.meta?.preTokenBalances ?? [];

  const preMap = new Map<string, number>();
  for (const bal of preBalances) {
    if (!bal.owner) continue;
    preMap.set(`${bal.owner}-${bal.mint}`, Number(bal.uiTokenAmount.uiAmountString ?? bal.uiTokenAmount.uiAmount ?? 0));
  }

  const increases: TokenIncrease[] = [];
  for (const bal of postBalances) {
    if (bal.owner !== owner) continue;
    const key = `${bal.owner}-${bal.mint}`;
    const previous = preMap.get(key) ?? 0;
    const current = Number(bal.uiTokenAmount.uiAmountString ?? bal.uiTokenAmount.uiAmount ?? 0);
    const delta = current - previous;
    if (delta > 0) {
      increases.push({ mint: bal.mint, amount: delta });
    }
  }

  return increases;
}

type InvoiceWithCursor = Invoice & { cursor: IndexerCursor | null };

export function createIndexerRuntime({ rpcClient, prisma, config, logger }: IndexerDependencies) {
  let lastPollAt: number | null = null;
  let lastInvoiceCount = 0;
  let skippedDueToCircuit = 0;

  async function markInvoicePaid(invoiceId: string, signature: string, blockTime?: number | null) {
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: 'PAID',
        txHash: signature,
        paidAt: blockTime ? new Date(blockTime * 1000) : new Date(),
      },
    });
  }

  async function upsertCursor(invoiceId: string, lastSignature: string | null) {
    await prisma.indexerCursor.upsert({
      where: { invoiceId },
      update: { lastSignature },
      create: { invoiceId, lastSignature },
    });
  }

  async function processSignature(invoice: InvoiceWithCursor, signature: string) {
    const tx = await rpcClient.getParsedTransaction(signature, { maxSupportedTransactionVersion: 0 });
    if (!tx) return false;

    const expectedMemo = `${config.memoPrefix}${invoice.slug}`;
    if (config.requireMemoMatch) {
      const memos = extractMemos(tx);
      const memoMatched = memos.includes(expectedMemo);
      if (!memoMatched) return false;
    }

    const expectedAmount = new Prisma.Decimal(invoice.amount).toNumber();
    if (!Number.isFinite(expectedAmount)) return false;

    if (!invoice.tokenAddress) {
      const solIncrease = getSolIncrease(tx, invoice.receiveAddress);
      return solIncrease >= expectedAmount;
    }

    const tokenIncreases = getSplIncreases(tx, invoice.receiveAddress);
    return tokenIncreases.some((inc) => inc.mint === invoice.tokenAddress && inc.amount >= expectedAmount);
  }

  async function checkInvoice(invoice: InvoiceWithCursor) {
    if (invoice.status === 'PAID') return;

    const lastSignature = invoice.cursor?.lastSignature ?? undefined;
    const address = new PublicKey(invoice.receiveAddress);

    const signatures = await rpcClient.getSignaturesForAddress(address, {
      limit: 20,
      until: lastSignature,
    });

    if (signatures.length === 0) {
      return;
    }

    const newestSignature = signatures[0].signature;
    for (const info of signatures.reverse()) {
      const paid = await processSignature(invoice, info.signature);
      if (paid) {
        await markInvoicePaid(invoice.id, info.signature, info.blockTime);
        await upsertCursor(invoice.id, newestSignature);
        logger.info('Invoice paid', { slug: invoice.slug, signature: info.signature });
        return;
      }
    }

    await upsertCursor(invoice.id, newestSignature);
  }

  async function pollOnce() {
    const status = rpcClient.status();
    if (status.state === 'open' && status.openUntil && status.openUntil > Date.now()) {
      logger.warn('RPC circuit open; skipping poll cycle', {
        endpoint: status.endpoint,
        openUntil: status.openUntil,
        failureCount: status.failureCount,
      });
      skippedDueToCircuit += 1;
      lastPollAt = Date.now();
      return;
    }

    const unpaid = await prisma.invoice.findMany({
      where: { status: { not: 'PAID' }, chain: config.chain },
      include: { cursor: true },
    });
    lastInvoiceCount = unpaid.length;
    for (const invoice of unpaid) {
      try {
        await checkInvoice(invoice as InvoiceWithCursor);
      } catch (err) {
        logger.error({ err, invoiceId: invoice.id }, 'Error processing invoice');
      }
    }
    lastPollAt = Date.now();
  }

  async function start() {
    logger.info('Indexer starting', { rpcUrl: config.rpcUrl, pollIntervalMs: config.pollIntervalMs });
    await pollOnce();
    const interval = setInterval(() => {
      pollOnce().catch((err) => logger.error({ err }, 'Polling error'));
    }, config.pollIntervalMs);
    return () => clearInterval(interval);
  }

  return {
    start,
    pollOnce,
    checkInvoice,
    processSignature,
    upsertCursor,
    markInvoicePaid,
    getSolIncrease,
    getSplIncreases,
    extractMemos,
    rpcStatus: () => rpcClient.status(),
    healthSnapshot: () => ({
      lastPollAt,
      lastInvoiceCount,
      skippedDueToCircuit,
      rpc: rpcClient.status(),
    }),
  };
}

export type IndexerRuntime = ReturnType<typeof createIndexerRuntime>;

