# Next steps for CloakLink contributors

## Current state (Solana pivot)
- **API**: Zod schemas validate Solana Base58 public keys via `@solana/web3.js`; default envs target Solana RPCs. Profile and invoice payloads accept Solana recipients and optional SPL mint addresses. Prisma migrations include an `IndexerCursor` table shared with the indexer runtime.
- **Frontend**: `InvoiceForm` rejects `0x` addresses, accepts Base58 recipients, and clarifies SPL mint handling (blank = SOL). Amount/slug validation and copy helpers remain intact.
- **Indexer**: Solana RPC poller refactored into a runtime with config validation, structured logging, memo-aware SOL/SPL detection, retry/timeouts, and per-invoice cursor persistence via Prisma (no more local files). Env template covers RPC URL, retries, memo enforcement, and logging level.
- **Tooling & tests**: Workspace lint/test scripts cover API integrations, invoice end-to-end payment flow with mocked RPC, and indexer runtime unit tests. Prisma client generation now runs automatically before API tests to avoid CI initialization failures. Dockerfile/docker-compose provide a dev stack (Postgres + API + frontend + indexer). CI workflow runs lint/test.

## What the next engineer should know
- Provide a reachable Solana RPC endpoint (`INDEXER_RPC_URL` / `API_SOLANA_RPC_URL`). Mainnet-beta URLs are referenced in examples; devnet works for testing.
- Prisma migrations must run before starting API or indexer (`npm run db:migrate` from repo root) so `IndexerCursor` is available. Postgres is the default datastore; ensure `DATABASE_URL` points at the running container/service.
- Indexer matching enforces memo strings when configured and checks lamport/token balance increases for the recipient. Cursor state is written via Prisma; ensure DB connectivity and permissions. RPC retry/backoff and timeouts are configurable through env.
- Docker-compose starts Postgres, API, indexer, and frontend together for local dev. Vitest suites mock Solana RPC and will seed schemas into Postgres when migrations run.
- Frontend mint field is optional; leaving it blank means SOL. Decimals are inferred from invoices (no on-chain mint lookup yet).

## Suggested next steps
1. Migrate from SQLite to Postgres for production: update Prisma datasource, add migration workflow, and ensure Docker/CI use Postgres containers.
2. Add observability for the indexer (structured metrics/health endpoints, alerting on RPC lag or cursor stalls) and document runbook expectations.
3. Harden RPC error handling with circuit breakers and adaptive backoff; cache account/mint metadata to cut RPC load.
4. Extend memo/amount verification with replay protection (idempotency keys) and safeguards against partial token transfers.
5. Broaden automated tests: frontend integration/e2e against dev server, indexer integration against a Solana test validator or richer RPC mocks, and race-condition coverage around cursor updates.
6. Provide operator tooling: migrations CLI wrappers, seed scripts for demo data, and a rollback path for indexer cursors.
