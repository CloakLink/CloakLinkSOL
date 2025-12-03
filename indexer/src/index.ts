import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const rpcUrl = process.env.RPC_URL;
const chain = process.env.CHAIN ?? 'ethereum';
const interval = Number(process.env.POLL_INTERVAL_MS ?? '15000');

async function checkInvoice(invoiceId: string) {
  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) return;

  // Placeholder logic: mark paid when a txHash is attached externally.
  // This keeps the script functional while leaving room for real RPC checks.
  if (invoice.txHash && invoice.status !== 'PAID') {
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: { status: 'PAID', paidAt: new Date() },
    });
    console.log(`Invoice ${invoice.slug} marked PAID via txHash ${invoice.txHash}`);
    return;
  }

  console.log(`Invoice ${invoice.slug} still ${invoice.status}. RPC check stub for ${chain} at ${rpcUrl ?? 'unset RPC_URL'}.`);
}

async function pollOnce() {
  const unpaid = await prisma.invoice.findMany({ where: { status: { not: 'PAID' } } });
  for (const invoice of unpaid) {
    await checkInvoice(invoice.id);
  }
}

async function main() {
  console.log(`Indexer running. Polling every ${interval}ms`);
  await pollOnce();
  setInterval(() => {
    pollOnce().catch((err) => console.error('Polling error', err));
  }, interval);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
