import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { Connection, LAMPORTS_PER_SOL, PublicKey, clusterApiUrl, ParsedTransactionWithMeta } from '@solana/web3.js';
import { readFile, writeFile } from 'fs/promises';
import path from 'path';

const prisma = new PrismaClient();
const rpcUrl = process.env.RPC_URL ?? clusterApiUrl('mainnet-beta');
const interval = Number(process.env.POLL_INTERVAL_MS ?? '15000');
const cursorFile = path.resolve(process.cwd(), 'data/indexer-cursors.json');

type CursorMap = Record<string, string>;

async function loadCursors(): Promise<CursorMap> {
  try {
    const raw = await readFile(cursorFile, 'utf8');
    return JSON.parse(raw) as CursorMap;
  } catch (err) {
    return {} as CursorMap;
  }
}

async function saveCursors(cursors: CursorMap) {
  await writeFile(cursorFile, JSON.stringify(cursors, null, 2));
}

const connection = new Connection(rpcUrl, 'confirmed');

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

async function processSignature(
  invoice: { id: string; receiveAddress: string; amount: any; tokenAddress: string | null },
  signature: string
) {
  const tx = await connection.getParsedTransaction(signature, { maxSupportedTransactionVersion: 0 });
  if (!tx) return false;

  const expectedAmount = Number(invoice.amount);
  if (!Number.isFinite(expectedAmount)) return false;

  if (!invoice.tokenAddress) {
    const solIncrease = getSolIncrease(tx, invoice.receiveAddress);
    return solIncrease >= expectedAmount;
  }

  const tokenIncreases = getSplIncreases(tx, invoice.receiveAddress);
  return tokenIncreases.some((inc) => inc.mint === invoice.tokenAddress && inc.amount >= expectedAmount);
}

async function checkInvoice(invoiceId: string, cursors: CursorMap) {
  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice || invoice.status === 'PAID') return cursors;

  const lastSignature = cursors[invoice.id];
  const address = new PublicKey(invoice.receiveAddress);

  const signatures = await connection.getSignaturesForAddress(address, {
    limit: 20,
    until: lastSignature,
  });

  if (signatures.length === 0) {
    return cursors;
  }

  const newestSignature = signatures[0].signature;
  for (const info of signatures.reverse()) {
    const paid = await processSignature(
      { id: invoice.id, receiveAddress: invoice.receiveAddress, amount: invoice.amount, tokenAddress: invoice.tokenAddress ?? null },
      info.signature
    );
    if (paid) {
      await markInvoicePaid(invoice.id, info.signature, info.blockTime);
      cursors[invoice.id] = newestSignature;
      console.log(`Invoice ${invoice.slug} marked PAID via ${info.signature}`);
      return cursors;
    }
  }

  cursors[invoice.id] = newestSignature;
  return cursors;
}

async function pollOnce(cursors: CursorMap) {
  const unpaid = await prisma.invoice.findMany({ where: { status: { not: 'PAID' }, chain: 'solana' } });
  for (const invoice of unpaid) {
    try {
      await checkInvoice(invoice.id, cursors);
    } catch (err) {
      console.error(`Error processing invoice ${invoice.id}`, err);
    }
  }
  await saveCursors(cursors);
}

async function main() {
  console.log(`Indexer running against ${rpcUrl}. Polling every ${interval}ms`);
  const cursors = await loadCursors();
  await pollOnce(cursors);
  setInterval(() => {
    pollOnce(cursors).catch((err) => console.error('Polling error', err));
  }, interval);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
