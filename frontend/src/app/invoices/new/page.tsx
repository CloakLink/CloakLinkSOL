import { InvoiceForm } from '@/components/InvoiceForm';
import { fetchProfiles } from '@/lib/api';

export default async function NewInvoicePage() {
  const profiles = await fetchProfiles();
  const profile = profiles[0];

  if (!profile) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 px-6 py-12">
        <div className="max-w-3xl mx-auto space-y-4">
          <h1 className="text-3xl font-semibold">New invoice</h1>
          <p className="text-slate-300">Create a profile first via the API to start issuing invoices.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 px-6 py-12">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <p className="text-sm text-slate-400">Issuing from profile</p>
          <h1 className="text-3xl font-semibold">{profile.alias}</h1>
          <p className="text-slate-400 text-sm">Default chain: {profile.defaultChain}</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
          <InvoiceForm profileId={profile.id} defaultChain={profile.defaultChain} />
        </div>
      </div>
    </main>
  );
}
