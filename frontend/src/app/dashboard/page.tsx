import Link from 'next/link';
import { fetchInvoicesForProfile, fetchProfiles } from '@/lib/api';

export default async function DashboardPage() {
  let profiles = [] as Awaited<ReturnType<typeof fetchProfiles>>;
  try {
    profiles = await fetchProfiles();
  } catch (err) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 px-6 py-12">
        <div className="max-w-4xl mx-auto space-y-4">
          <h1 className="text-3xl font-semibold">Dashboard</h1>
          <p className="text-red-400">Failed to load profiles. Ensure the API server is running.</p>
        </div>
      </main>
    );
  }

  const defaultProfile = profiles[0];

  if (!defaultProfile) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 px-6 py-12">
        <div className="max-w-4xl mx-auto space-y-4">
          <h1 className="text-3xl font-semibold">Dashboard</h1>
          <p className="text-slate-300">No profiles found. Create one via the API to get started.</p>
        </div>
      </main>
    );
  }

  const invoices = await fetchInvoicesForProfile(defaultProfile.id);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 px-6 py-12">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <p className="text-sm text-slate-400">Default profile</p>
            <h1 className="text-3xl font-semibold">{defaultProfile.alias}</h1>
            <p className="text-slate-400 text-sm">Receive address: {defaultProfile.receiveAddress}</p>
          </div>
          <Link
            href="/invoices/new"
            className="inline-flex items-center justify-center rounded-lg bg-emerald-500 px-4 py-2 font-medium text-slate-900 hover:bg-emerald-400 transition"
          >
            + New invoice
          </Link>
        </div>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Invoices</h2>
            <p className="text-sm text-slate-400">Polling uses indexer; refresh to see latest status.</p>
          </div>
          <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/50">
            <table className="min-w-full text-left">
              <thead className="bg-slate-900/70 text-slate-400 text-sm">
                <tr>
                  <th className="px-4 py-3 font-medium">Slug</th>
                  <th className="px-4 py-3 font-medium">Amount</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {invoices.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                      No invoices yet. Create one to generate a payment link.
                    </td>
                  </tr>
                )}
                {invoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-slate-900/70">
                    <td className="px-4 py-3 text-emerald-300">{invoice.slug}</td>
                    <td className="px-4 py-3">
                      {invoice.amount} {invoice.tokenSymbol}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-slate-800 px-3 py-1 text-sm capitalize">{invoice.status.toLowerCase()}</span>
                    </td>
                    <td className="px-4 py-3">
                      <Link className="text-emerald-400 hover:underline" href={`/i/${invoice.slug}`}>
                        View link
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
