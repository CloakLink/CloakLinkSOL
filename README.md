# CloakLink

CloakLink is an open-source, privacy-minded payment link generator for crypto. Create invoices that hide your main wallet while staying non-custodial. The Simple Mode MVP routes all invoices for a profile to a dedicated receive address on Solana.

## Packages
- `api`: Express + Prisma API with PostgreSQL storage for profiles and invoices (Solana address validation built-in).
- `frontend`: Next.js + Tailwind dashboard and public invoice pages.
- `indexer`: Solana polling script using `@solana/web3.js` to mark invoices paid when SOL or SPL token transfers land at the receive address.

## Prerequisites
- Node.js 20+
- npm

## Getting started
1. Install dependencies (workspace-aware):
   ```bash
   npm install
   ```
2. Prepare environment variables (examples are checked in):
   - API: copy `api/.env.example` to `api/.env` and adjust `DATABASE_URL`, `PORT`, and default profile fields.
   - Frontend: copy `frontend/.env.local.example` to `frontend/.env.local` and set `NEXT_PUBLIC_API_URL` (defaults to `http://localhost:4000`).
   - Indexer: copy `indexer/.env.example` to `indexer/.env` and set `DATABASE_URL` (point to the shared Postgres instance) and `RPC_URL` (defaults to `https://api.mainnet-beta.solana.com`).
3. Run database migration and generate Prisma client (requires Postgres running locally or via Docker):
   ```bash
   npm run db:migrate
   npm run db:generate
   ```

## Running services
- **API**
  ```bash
  cd api
  npm run dev
  ```
  Health check: `GET http://localhost:4000/health`

- **Frontend**
  ```bash
  cd frontend
  npm run dev
  ```
  Open http://localhost:3000 for the landing page and dashboard.

- **Indexer** (Solana RPC poller for SOL + SPL payments)
  ```bash
  cd indexer
  npm run dev
  ```

- **Run API + Frontend together**
  ```bash
  npm run dev
  ```

## Solana payment flow and indexer runbook
- Invoices inherit the profile receive address and target chain (Solana) and optionally an SPL mint address.
- The indexer polls RPC using `getSignaturesForAddress` and `getParsedTransaction`, validates memo prefixes when enabled, and checks lamport/token balance deltas to detect payments.
- Cursor positions and invoice statuses are persisted via Prisma in the shared Postgres database. Keep the API and indexer `DATABASE_URL` values aligned.
- Tune resilience with `POLL_INTERVAL_MS`, `RPC_MAX_RETRIES`, `RPC_RETRY_DELAY_MS`, and `RPC_TIMEOUT_MS` in `indexer/.env`.
- For production, provision a reliable Solana RPC endpoint and monitor logs for repeated RPC failures.

## Key API routes
- `POST /profiles` – create a profile.
- `GET /profiles` – list profiles.
- `GET /profiles/:id` – fetch a profile.
- `POST /profiles/:id/invoices` – create an invoice for a profile.
- `GET /profiles/:id/invoices` – list invoices for a profile.
- `GET /invoices/:id` – fetch invoice by id.
- `GET /invoices/:id/status` – invoice status by id.
- `GET /invoices/slug/:slug` – public invoice lookup by slug.
- `GET /invoices/slug/:slug/status` – status by slug.

## Testing and CI
- Run workspace tests: `npm run test`
- Run linters: `npm run lint`
- Combined check: `npm run check`
- GitHub Actions workflow (`.github/workflows/ci.yml`) installs dependencies, lints, and runs tests for all workspaces.

## Dockerized local development
Docker Compose spins up Postgres, API, frontend, and indexer:
```bash
docker compose up --build
```
Environment defaults come from `api/.env.example` and `indexer/.env.example`; override as needed for your Solana RPC and Postgres credentials.

## Project goals
- Non-custodial, no mixing.
- Keep main wallet privacy by using dedicated receive addresses.
- Simple Mode now, with room for future derived/stealth addresses.

## License
MIT
