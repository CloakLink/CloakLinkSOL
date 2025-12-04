# Next steps for CloakLink contributors

## Current state (Iteration 6: operational readiness)
- **API**: Express now uses Pino with request-scoped correlation IDs, Prometheus metrics (`/metrics`) capturing HTTP duration histograms, Helmet security headers, and strict Zod-based env validation that fails fast. Prisma connections are managed via a shared client with graceful shutdown on SIGINT/SIGTERM.
- **Indexer**: Structured Pino logging with component bindings, Prometheus metrics (`/metrics`) tracking RPC call counts/durations, health endpoint, and expanded env validation (RPC/DB/ports). Signal-aware shutdown closes Prisma and HTTP servers cleanly.
- **Containerization/ops**: Dockerfile is multi-stage with a non-root runtime user and production install. Compose files expose production commands/ports; observability endpoints are documented. Repo scripts remain for migrations, health checks, and seeding.
- **Frontend**: Remains Next.js-based with Solana-aware invoice inputs (Base58 recipients, optional SPL mint). Validation and copy helpers unchanged from prior iteration.

## What the next engineer should know
- Provide working Solana RPC URLs for both API and indexer (`API_SOLANA_RPC_URL`, `INDEXER_RPC_URL`). Metrics endpoints are available at `/metrics` on API and indexer; health endpoint remains on the indexer health server.
- Run Prisma migrations before starting services (`npm run db:migrate` from repo root). PostgreSQL is the expected datastore; ensure `DATABASE_URL` is reachable for both API and indexer. Env validation will fail startup if required vars are missing.
- Logging is standardized on Pino JSON. Request IDs are injected at the API gateway; indexer logs include component bindings. Avoid introducing `console.log`/`morgan` or other loggers.
- Docker images now build via multi-stage and run as a non-root user. Compose files include production commands; adjust ports/ingress as needed. If modifying the Dockerfile, verify with `docker compose build api`.
- Graceful shutdown paths are in place; ensure new long-lived connections (e.g., new DB clients or RPC websockets) are added to the shutdown sequence.
- Security headers are enforced via Helmet; maintain this for new routes. Continue to avoid logging secrets/PII.

## Suggested next steps
1. Centralize observability: route Pino logs to a collector (e.g., Loki/ELK) with dashboards for HTTP latency, RPC errors, cursor lag, and health status; add alerts for stalled invoices or repeated circuit-breaker openings.
2. Harden secrets and ingress: enforce managed secret storage, enable TLS termination, add security headers/csp tuning for frontend, and integrate dependency/container scanning in CI.
3. Improve RPC resilience: add endpoint scoring and request hedging for critical reads, plus configuration to quarantine misbehaving providers; consider integrating Solana validator health checks.
4. Expand automated testing: run full-stack flows against Postgres with richer RPC mocks or test-validator, covering invoice lifecycle through settlement and frontend updates with metrics assertions.
5. Database and migration ops: document/automate backups, PITR where available, and failover drills; add migration safety checks and pgbouncer/connection pooling guidance for production.
6. SRE readiness: define SLOs for settlement latency and API uptime, publish runbooks for degraded RPC or DB incidents, and rehearse incident simulations with on-call rotation.
