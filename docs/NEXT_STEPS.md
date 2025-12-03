# Next steps for CloakLink contributors

This guide orients the next developer on the current codebase, what to read first, and a prioritized backlog for advancing the Simple Mode MVP toward production readiness.

## Where to start reading
- **API entrypoint:** `api/src/server.ts` — Express routes for profiles/invoices plus default profile seeding and validation with Zod. Review how slugs are generated and how the default profile is injected on startup. 【F:api/src/server.ts†L1-L136】
- **Database models:** `api/prisma/schema.prisma` — Prisma schema defining `Profile` and `Invoice`, including Decimal amount, slug uniqueness, and enum-backed status defaults. 【F:api/prisma/schema.prisma†L1-L35】
- **Indexer stub:** `indexer/src/index.ts` — Polls for unpaid invoices and currently marks them paid when `txHash` is set; ready to swap in real RPC checks. 【F:indexer/src/index.ts†L1-L35】
- **Frontend API client:** `frontend/src/lib/api.ts` — Fetch helpers and type definitions for profiles/invoices; informs how frontend calls the API. 【F:frontend/src/lib/api.ts†L1-L53】
- **Frontend surfaces:**
  - Dashboard + invoice list: `frontend/src/app/dashboard/page.tsx`
  - Invoice creation form: `frontend/src/components/InvoiceForm.tsx`
  - Public invoice page: `frontend/src/app/i/[slug]/page.tsx`
  These pages demonstrate the expected API payloads and rendering states. 【F:frontend/src/app/dashboard/page.tsx†L1-L101】【F:frontend/src/components/InvoiceForm.tsx†L1-L136】【F:frontend/src/app/i/[slug]/page.tsx†L1-L60】
- **Docs:**
  - High-level architecture: `docs/ARCHITECTURE.md`
  - Privacy model: `docs/PRIVACY_MODEL.md`
  - Root `README.md` for workspace commands and API routes.

## Environment + setup expectations
- This is an npm workspace with `api`, `frontend`, and `indexer` packages; run installs from repo root (`npm install`). 【F:package.json†L10-L22】
- SQLite database URL is expected in each package via `DATABASE_URL`; Prisma migration name `init` already exists but `.env.example` files are **not yet** checked in — add them. 【F:README.md†L15-L37】
- Default profile values come from environment (`DEFAULT_PROFILE_ALIAS`, `DEFAULT_RECEIVE_ADDRESS`, `DEFAULT_CHAIN`) and are seeded on API start. 【F:api/src/server.ts†L31-L55】

## Immediate cleanup tasks
1. **Add environment templates:** Create `.env.example` files for `api`, `frontend`, and `indexer` covering `DATABASE_URL`, ports, default profile fields, `NEXT_PUBLIC_API_URL`, and `RPC_URL/CHAIN/POLL_INTERVAL_MS` so onboarding is deterministic. 【F:README.md†L15-L37】
2. **Document migration flow:** Add a short `api/README` snippet or script to ensure `npx prisma migrate dev --name init` and `prisma generate` are run before services start.
3. **Root scripts polish:** Consider adding combined dev scripts (e.g., concurrently running API + frontend) and lint/format commands for API/indexer.

## API improvements to tackle next
1. **Status computation:** Replace manual `txHash` toggling with real chain checks. Implement ERC-20/native transfer detection per invoice using `receiveAddress`, `amount`, and `chain`. Extend `Invoice` to store token contract address/decimals if needed. 【F:indexer/src/index.ts†L1-L35】
2. **Validation hardening:** Expand Zod schemas to validate Ethereum addresses, token symbols, positive decimals, and optional expiry. Enforce slug uniqueness errors with clearer messages. 【F:api/src/server.ts†L17-L47】
3. **Error surface:** Standardize API error responses (shape + codes). Add request logging correlation IDs for easier debugging.
4. **Profile concepts:** Add profile retrieval by slug/alias, optional avatar/description fields, and pagination for invoice listing endpoints.
5. **Auth readying:** Leave hooks for future auth (e.g., API keys per profile) without enforcing yet.

## Indexer roadmap
1. **RPC integration:** Wire ethers.js/viem to connect to `RPC_URL`, fetch token decimals, and verify transfers to `receiveAddress` since `createdAt` (or last checked block). Update invoices to `PAID` with `paidAt` and store observed transaction hash.
2. **Polling resilience:** Track last-processed block height to avoid re-scanning from genesis; persist cursor in DB.
3. **Multi-chain prep:** Parameterize chain configs (RPC URL, confirmations, native/token type) and allow per-invoice chain values.
4. **Notifications:** Emit webhooks or enqueue events when invoices flip to PAID.

## Frontend follow-ups
1. **Loading/error states:** Add skeletons/spinners and user-friendly error banners around API calls in dashboard and invoice pages. 【F:frontend/src/app/dashboard/page.tsx†L1-L101】【F:frontend/src/components/InvoiceForm.tsx†L1-L136】
2. **Form validation:** Enforce token/amount/description constraints client-side to mirror server validation; surface slug preview.
3. **Public page polish:** Add QR code download, copy-to-clipboard, and payer guidance per chain (gas tips, explorer link when paid). 【F:frontend/src/app/i/[slug]/page.tsx†L1-L60】
4. **Profile selection:** Introduce profile picker or creation flow on the frontend instead of assuming a single default profile.

## Testing + quality
- Add API unit/integration tests (Supertest/Jest or Vitest) for route validation, slug uniqueness, and happy paths.
- Add frontend component tests (React Testing Library) for form submission and public invoice rendering.
- Provide lint/format configs for API and indexer; currently only frontend lint is wired. 【F:package.json†L10-L22】

## Deployment considerations
- Package API and frontend into Docker images; mount SQLite volume or switch to Postgres for multi-instance deployments.
- Introduce migration/seed steps in CI/CD.
- Add rate limiting and CORS tightening before public exposure.

## Open questions to clarify with stakeholders
- Which chains/tokens must be supported first? (Impacts indexer logic and UI hints.)
- Should invoices expire or enforce unique slugs per profile vs. globally?
- How will notifications be delivered (email/webhook/Slack)?
- Are payer identities tracked or is the system intentionally anonymous beyond payment proof?

With the above, a new contributor can quickly bootstrap the environment, understand current behavior, and pick high-value tasks to move CloakLink toward a production-ready Simple Mode.
