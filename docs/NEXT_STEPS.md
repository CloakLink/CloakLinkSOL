# Next steps for CloakLink contributors

## Current state (Solana pivot)
- **API**: Prisma targets PostgreSQL by default with migrations/seed scripts, wait-for-DB gating, and Zod schemas that validate Solana Base58 public keys via `@solana/web3.js`. Invoice/profile payloads accept Solana recipients and optional SPL mint addresses. Migrations include an `IndexerCursor` table shared with the indexer runtime.
- **Frontend**: `InvoiceForm` rejects `0x` addresses, accepts Base58 recipients, and clarifies SPL mint handling (blank = SOL). Amount/slug validation and copy helpers remain intact.
- **Indexer**: RPC poller runs through a circuit-breaking client that adds endpoint rotation, adaptive backoff, memo-aware SOL/SPL detection, and runtime health snapshots served over HTTP. Cursor state and invoice matches persist via Prisma to Postgres.
- **Tooling & tests**: Workspace lint/test scripts cover API integrations, invoice end-to-end payment flow with mocked RPC, indexer runtime + circuit breaker, and a Postgres integration smoke test. Dockerfile/docker-compose provide a dev stack (Postgres + API + frontend + indexer), and CI runs lint/test with Prisma client generation preflighted. Backup/restore helpers and an operator runbook are available in `scripts/` and `docs/`.

## What the next engineer should know
- Provide a reachable Solana RPC endpoint (`INDEXER_RPC_URL` / `API_SOLANA_RPC_URL`). Mainnet-beta URLs are referenced in examples; devnet works for testing.
- Prisma migrations must run before starting API or indexer (`npm run db:migrate` from repo root) so `IndexerCursor` is available. PostgreSQL is the default datastore; ensure `DATABASE_URL` points at the running service, and Postgres credentials are accessible to both API and indexer.
- Indexer matching enforces memo strings when configured and checks lamport/token balance increases for the recipient. Cursor state is written via Prisma; ensure DB connectivity and permissions. RPC retry/backoff, endpoint rotation, caching, memo enforcement, and logging level are configurable through env.
- Docker-compose starts Postgres, API, indexer, and frontend together for local dev. Vitest suites mock Solana RPC and will seed schemas into Postgres when migrations run.
- Frontend mint field is optional; leaving it blank means SOL. Decimals are inferred from invoices (no on-chain mint lookup yet).
- Operators have basic Postgres dump/restore scripts plus a runbook for migrations, cursor recovery, and health checks.

## Suggested next steps
1. Productionize PostgreSQL: move to a managed/HA service with automated backups, TLS, connection pooling (e.g., pgbouncer), and credential rotation; document restore drills.
2. Build observability pipelines: ship structured logs/metrics to a central stack, add dashboards for RPC latency, cursor lag, and health server status, and wire alerts for sustained circuit-breaker opens or stalled invoices.
3. Broaden RPC resilience: support prioritized endpoint pools with health scoring, request hedging for critical reads, and configuration to drop or quarantine misbehaving providers.
4. Expand end-to-end coverage: run the full stack against Postgres with Solana test-validator or richer RPC mocks, exercising invoice creation through indexer settlement and frontend updates.
5. Strengthen security posture: enforce secrets management (no plain-text `.env` in production), enable TLS for all ingress, add dependency scanning, and validate webhook-style callbacks if/when exposed.
6. Formalize SRE readiness: define SLOs for settlement latency and API availability, add runbooks for degraded RPC scenarios and Postgres failover, and rehearse incident simulations.
