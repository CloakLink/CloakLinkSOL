# Iteration Plan

## Infrastructure tasks
- [x] Postgres migration: switch Prisma datasource to PostgreSQL schema definition and regenerate client artifacts.
- [x] Containerize Postgres: add a Postgres service with persistent volume and healthchecks in docker-compose and wire API/indexer to it.
- [x] Database migrations workflow: create fresh Prisma migration targeting Postgres and add npm scripts for migrate/deploy in all services.
- [x] Environment templates: update api/indexer .env.example files and docs to default to Postgres connection strings instead of SQLite paths.
- [x] Service startup gating: add a wait-for-DB entrypoint to API and indexer images so they block until Postgres is reachable.
- [x] Prisma connection tuning: expose pool configuration via env vars and set sensible defaults for production.
- [x] CI pipeline update: ensure tests/lint use Postgres in CI by starting a container, running migrations, and pointing DATABASE_URL accordingly.
- [x] Operator runbook: document migration/backups/rollbacks for Postgres and indexer cursor resets.
- [x] Migration/seed CLI: add npm scripts to run migrations and seed demo data with Prisma for operators.
- [x] Data backup automation: add script or make target to dump/restore Postgres data for local/dev stacks.
- [x] Circuit breaker: wrap Solana RPC client in a circuit breaker with configurable failure thresholds and cooldown.
- [x] Adaptive backoff: implement exponential backoff with jitter for RPC retries in indexer runtime and API client utilities.
- [x] RPC endpoint failover: allow configuring multiple RPC URLs and rotate through them on failure with logging.
- [x] Metadata caching: cache token/mint metadata and account info to cut RPC load with TTL invalidation.
- [x] Indexer health endpoint: expose HTTP health/metrics for indexer (cursor lag, RPC status, breaker state).
- [x] Structured RPC logging: centralize RPC error logging with request/response metadata for observability.
- [x] Circuit breaker tests: add unit tests covering breaker transitions, backoff, and endpoint rotation.
- [x] Indexer health tests: add tests for health endpoint responses and metadata cache behavior.
- [x] Postgres integration tests: add minimal API/indexer integration test using Postgres (via docker or testcontainer) to validate migrations.
- [x] Compose override for prod-like deploy: add docker-compose.prod.yml that runs migrations on boot and wires services to Postgres with stricter settings.
