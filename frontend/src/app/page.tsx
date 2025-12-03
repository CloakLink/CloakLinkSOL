import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-slate-950 to-slate-900 text-white px-6 py-16">
      <div className="max-w-3xl text-center space-y-6">
        <p className="rounded-full border border-slate-700 px-3 py-1 text-sm text-slate-300 inline-block">
          Non-custodial • Privacy-minded • Open-source
        </p>
        <h1 className="text-4xl md:text-5xl font-semibold leading-tight">
          CloakLink lets you share payment links without doxxing your main wallet.
        </h1>
        <p className="text-lg text-slate-300">
          Create a Cloak profile, generate invoices in USDC/WETH/etc., and track when clients pay. Funds go directly to your
          dedicated receive address—no custody, no mixers, just privacy hygiene.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/dashboard"
            className="rounded-lg bg-emerald-500 px-6 py-3 font-medium text-slate-900 shadow-lg hover:bg-emerald-400 transition"
          >
            Go to Dashboard
          </Link>
          <Link
            href="/docs"
            className="rounded-lg border border-slate-700 px-6 py-3 font-medium text-slate-200 hover:border-slate-500 transition"
          >
            View project docs
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left text-slate-200 mt-8">
          <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
            <h3 className="font-semibold">Simple Mode</h3>
            <p className="text-sm text-slate-400">All invoices route to a dedicated receive wallet, keeping your main ENS safe.</p>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
            <h3 className="font-semibold">Self-hostable</h3>
            <p className="text-sm text-slate-400">Run locally with SQLite and a lightweight Node backend.</p>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
            <h3 className="font-semibold">Stealth-ready</h3>
            <p className="text-sm text-slate-400">Architecture keeps room for future derived-address / stealth invoice mode.</p>
          </div>
        </div>
      </div>
    </main>
  );
}
