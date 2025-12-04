# Next steps for CloakLink contributors

## Current state (Solana pivot)
- **API**: Zod schemas validate Solana Base58 public keys via `@solana/web3.js`; default envs target the Solana network with example public keys. Profile and invoice payloads accept Solana recipients and optional SPL mint addresses.
- **Frontend**: `InvoiceForm` rejects `0x` addresses, accepts Base58 recipients, and clarifies SPL mint handling (blank = SOL). Amount/slug validation and copy helpers remain intact.
- **Indexer**: A Solana RPC poller (`@solana/web3.js`) uses `getSignaturesForAddress` and `getParsedTransaction` to detect SOL and SPL token payments, updates invoices to PAID on matches, and persists a cursor per receive address/signature. Env templates include RPC URL and polling interval.
- **Tooling & tests**: Workspaces share lint/test scripts; API build/test pass with the Solana validation. A profile creation integration test confirms Solana addresses are accepted.

## What the next engineer should know
- Provide a reachable Solana RPC endpoint (`INDEXER_RPC_URL` / `API_SOLANA_RPC_URL` if added later). Mainnet-beta URLs are referenced in examples; devnet works for testing.
- The indexer currently stores cursors in local files under `data/cursors` (per address). Ensure write permissions in the deployment environment.
- Invoice matching checks lamport or token balance increases for the recipient; no memo/timestamp guards yet.
- Frontend mint field is optional; leaving it blank means SOL. Decimals are inferred from invoices (no on-chain mint lookup yet).

## Suggested next steps
1. Add deeper indexer resilience: retries/backoff, RPC health logging, and alerting when cursor files fall behind.
2. Persist cursors and invoice status updates in the primary database instead of local files; consider migrations/Prisma helpers.
3. Enrich matching logic with memo/amount verification and prevent double processing across restarts.
4. Expand automated tests: indexer unit/integration coverage (mocked RPC), API/Frontend e2e flows for invoice creation and payment detection.
5. Wire dockerized local dev (API + frontend + indexer + SQLite volume) and document `npm run dev` expectations per workspace.
6. Refresh README/architecture docs with Solana payment flow diagrams and operational runbooks for the indexer.
