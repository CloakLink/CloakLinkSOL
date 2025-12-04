# Production Hardening Iteration Plan

- [x] 1) Persist indexer cursors in the primary database via Prisma migration and refactor indexer reads/writes to use the DB-backed cursor table.
- [x] 2) Add resilient RPC client behavior (timeouts, retries with backoff, and health logging) around Solana polling to withstand transient RPC issues.
- [x] 3) Enforce payment matching guards (memo/amount verification and idempotent handling) to prevent double-processing across restarts.
- [x] 4) Introduce structured logging and environment/config validation for the indexer to fail fast on misconfiguration.
- [x] 5) Build an indexer unit/integration test suite using Vitest with mocked Solana RPC covering SOL and SPL token payment detection.
- [x] 6) Expand API tests for Solana invoice/profile creation and validation error paths to protect the surface area.
- [x] 7) Create an end-to-end harness that runs API + indexer with a Prisma test DB and mocked RPC to validate invoice payment flow end-to-end.
- [x] 8) Dockerize local dev with docker-compose for API, frontend, indexer, and a persistent SQLite volume plus seeded env templates.
- [x] 9) Add monorepo-wide lint/test orchestration (root scripts/CI workflow) to keep workspaces consistent.
- [x] 10) Update README/docs with Solana flow diagrams, indexer runbook, and operational guidelines for production deployment.
