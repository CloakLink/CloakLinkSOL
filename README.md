# CloakLink

CloakLink is an open-source, privacy-minded payment link generator for crypto. Create invoices that hide your main wallet while staying non-custodial. The Simple Mode MVP routes all invoices for a profile to a dedicated receive address.

## Packages
- `api`: Express + Prisma API with SQLite storage for profiles and invoices.
- `frontend`: Next.js + Tailwind dashboard and public invoice pages.
- `indexer`: Polling script that marks invoices paid (stubbed to react to txHash for now) and is ready for RPC checks.

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
   - Indexer: copy `indexer/.env.example` to `indexer/.env` and set `DATABASE_URL` (point to the same SQLite file) and `RPC_URL`.
3. Run database migration and generate Prisma client (the default `.env` paths expect the SQLite DB under `./data`):
   ```bash
   cd api
   npx prisma migrate dev --name init
   cd ..
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

- **Indexer** (stubbed RPC checker that marks invoices paid when a `txHash` is present)
  ```bash
  cd indexer
  npm run dev
  ```

- **Run API + Frontend together**
  ```bash
  npm run dev
  ```

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

## Project goals
- Non-custodial, no mixing.
- Keep main wallet privacy by using dedicated receive addresses.
- Simple Mode now, with room for future derived/stealth addresses.

## License
MIT
