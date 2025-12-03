import QRCode from 'react-qr-code';
import Link from 'next/link';
import { fetchInvoiceBySlug } from '@/lib/api';

type InvoicePageProps = {
  params: { slug: string };
};

export default async function InvoicePage({ params }: InvoicePageProps) {
  const invoice = await fetchInvoiceBySlug(params.slug).catch(() => null);

  if (!invoice) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 px-6 py-12">
        <div className="max-w-3xl mx-auto space-y-4">
          <h1 className="text-3xl font-semibold">Invoice not found</h1>
          <Link className="text-emerald-400 hover:underline" href="/">
            Return home
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 px-6 py-12">
      <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-[2fr,1fr] gap-8">
        <div className="space-y-4">
          <p className="text-sm text-slate-400">Paying {invoice.profileAlias}</p>
          <h1 className="text-3xl font-semibold">{invoice.amount} {invoice.tokenSymbol}</h1>
          <p className="text-slate-300">Chain: {invoice.chain}</p>
          {invoice.description && <p className="text-slate-200">{invoice.description}</p>}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-2">
            <p className="text-sm text-slate-400">Send to receive address</p>
            <p className="break-all font-mono text-sm text-emerald-200">{invoice.receiveAddress}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-slate-800 px-3 py-1 text-sm capitalize">{invoice.status.toLowerCase()}</span>
            <span className="text-sm text-slate-400">Created {new Date(invoice.createdAt).toLocaleString()}</span>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 flex flex-col items-center gap-4">
          <QRCode value={invoice.receiveAddress} fgColor="#10b981" bgColor="transparent" size={200} />
          <p className="text-center text-sm text-slate-300">Scan or copy the address to complete payment.</p>
        </div>
      </div>
    </main>
  );
}
