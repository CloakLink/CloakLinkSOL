# Architecture

## Components
- **Frontend (Next.js)**: Landing page, dashboard, invoice creation, and public invoice view. Talks to API via `NEXT_PUBLIC_API_URL`.
- **API (Express + Prisma)**: Manages profiles and invoices in Postgres. Seeds a default profile on startup and exposes REST endpoints.
- **Indexer (Node script)**: Polls invoices and updates status. Currently marks invoices paid when a `txHash` is present, leaving room for future on-chain checks.
- **Database (PostgreSQL via Prisma)**: Durable relational store for profiles, invoices, and indexer cursors.

## Data models
- **Profile**: `id`, `alias`, `receiveAddress`, `defaultChain`, timestamps.
- **Invoice**: `id`, `profileId`, `slug`, `amount` (Decimal), `tokenSymbol`, `chain`, `receiveAddress`, `description`, `status`, `txHash`, timestamps.

## Data flow
1. User opens dashboard (frontend) → fetches profiles from API.
2. User creates invoice → frontend POSTs to `/profiles/:id/invoices`.
3. Payer visits `/i/:slug` → frontend fetches invoice details/status via public routes.
4. Indexer polls invoices with non-`PAID` status and updates records (ready for RPC-based detection).

## Extending toward stealth/derived mode
- Add client-side seed handling to derive per-invoice receive addresses before creating invoices.
- Store derived address metadata on invoice records.
- Extend indexer to monitor per-invoice addresses and sweep funds as needed.
