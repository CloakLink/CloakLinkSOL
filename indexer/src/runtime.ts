import { Prisma, type PrismaClient, type IndexerCursor, type Invoice } from '@prisma/client';
import { Connection, LAMPORTS_PER_SOL, PublicKey, type ParsedTransactionWithMeta } from '@solana/web3.js';
import { type IndexerConfig } from './config.js';
import { type createLogger } from './logger.js';

type Logger = ReturnType<typeof createLogger>;

export type IndexerDependencies = {
  connection: Pick<Connection, 'getSignaturesForAddress' | 'getParsedTransaction'>;
  prisma: Pick<PrismaClient, 'invoice' | 'indexerCursor'>;
  config: IndexerConfig;
  logger: Logger;
};

function toErrorContext(err: unknown) {
  if (err instanceof Error) {
    return { message: err.message, stack: err.stack };
  }
  return { message: String(err) };
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

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

export function createIndexerRuntime({ connection, prisma, config, logger }: IndexerDependencies) {
  let consecutiveRpcFailures = 0;

  async function withTimeout<T>(promise: Promise<T>, actionName: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`RPC ${actionName} timed out after ${config.rpcTimeoutMs}ms`));
      }, config.rpcTimeoutMs);

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

  async function withRpcRetry<T>(actionName: string, operation: () => Promise<T>): Promise<T> {
    let lastError: unknown;
    let delay = config.rpcRetryDelayMs;

    for (let attempt = 0; attempt <= config.rpcMaxRetries; attempt++) {
      try {
        const result = await withTimeout(operation(), actionName);
        if (consecutiveRpcFailures > 0) {
          logger.info(`RPC ${actionName} recovered`, { failures: consecutiveRpcFailures });
          consecutiveRpcFailures = 0;
        }
        return result;
      } catch (err) {
        lastError = err;
        consecutiveRpcFailures += 1;
        if (attempt === config.rpcMaxRetries) break;
        if (consecutiveRpcFailures === 1 || consecutiveRpcFailures % 3 === 0) {
          logger.warn(`RPC ${actionName} failed`, {
            attempt: attempt + 1,
            limit: config.rpcMaxRetries + 1,
            error: toErrorContext(err),
          });
        }
        await sleep(delay);
        delay = Math.min(delay * 2, 30000);
      }
    }

    logger.error(`RPC ${actionName} failed after ${config.rpcMaxRetries + 1} attempt(s)`, {
      error: toErrorContext(lastError),
    });
    throw lastError instanceof Error ? lastError : new Error('Unknown RPC error');
  }

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
    const tx = await withRpcRetry('getParsedTransaction', () =>
      connection.getParsedTransaction(signature, { maxSupportedTransactionVersion: 0 })
    );
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

    const signatures = await withRpcRetry('getSignaturesForAddress', () =>
      connection.getSignaturesForAddress(address, {
        limit: 20,
        until: lastSignature,
      })
    );

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
    const unpaid = await prisma.invoice.findMany({
      where: { status: { not: 'PAID' }, chain: config.chain },
      include: { cursor: true },
    });
    for (const invoice of unpaid) {
      try {
        await checkInvoice(invoice as InvoiceWithCursor);
      } catch (err) {
        logger.error('Error processing invoice', { invoiceId: invoice.id, error: toErrorContext(err) });
      }
    }
  }

  async function start() {
    logger.info('Indexer starting', { rpcUrl: config.rpcUrl, pollIntervalMs: config.pollIntervalMs });
    await pollOnce();
    const interval = setInterval(() => {
      pollOnce().catch((err) => logger.error('Polling error', { error: toErrorContext(err) }));
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
    withRpcRetry,
  };
}

export type IndexerRuntime = ReturnType<typeof createIndexerRuntime>;

