# Next steps for CloakLink contributors

## Recent changes
- Added environment templates for API, frontend, and indexer plus prisma setup notes in `api/README.md`.
- Hardened API validation (addresses, decimals, slug rules) and standardized errors; extended models with optional metadata and expiry fields.
- Introduced linting for API and indexer with flat configs and root lint script; added concurrent dev scripts.
- Frontend improvements: client-side invoice validation, slug preview, copy-to-clipboard on invoice page, and support for new invoice fields.

## What to tackle next
1. Implement real chain checks in the indexer (viem/ethers) to detect payments, using `tokenAddress`/`tokenDecimals` and persisting last-processed block.
2. Add pagination and profile selection on the dashboard; support profile avatar/description in UI.
3. Expand API with profile lookup by alias/slug and optional invoice expiry enforcement.
4. Add API + frontend tests (Supertest/RTL) for validation and user flows.
5. Consider Dockerfiles/Compose for API + frontend + SQLite volume; wire migrations into startup scripts.
6. Tighten CORS/rate limits and add structured logging in API/indexer.
7. Refresh README with payment flow diagrams and indexer expectations once RPC integration lands.
