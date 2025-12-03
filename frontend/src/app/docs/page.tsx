export default function DocsPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 px-6 py-12">
      <div className="max-w-3xl mx-auto space-y-4">
        <h1 className="text-3xl font-semibold">Project docs</h1>
        <p className="text-slate-300">Refer to the repository docs folder for deeper architecture and privacy notes.</p>
        <ul className="list-disc list-inside space-y-2 text-slate-300">
          <li>ARCHITECTURE.md – components, data flow, and model references.</li>
          <li>PRIVACY_MODEL.md – threat model, what CloakLink protects, and limitations.</li>
          <li>README – quickstart for running API, frontend, and indexer locally.</li>
        </ul>
      </div>
    </main>
  );
}
