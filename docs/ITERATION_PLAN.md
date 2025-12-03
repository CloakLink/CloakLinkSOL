# Iteration plan

25+ step plan for this iteration based on docs/NEXT_STEPS.md and code review.

1. Add `.env.example` for api with DATABASE_URL, PORT, default profile fields, ALLOW_ORIGIN.
2. Add `.env.example` for frontend (`.env.local.example`) with NEXT_PUBLIC_API_URL and NEXT_PUBLIC_CHAIN defaults.
3. Add `.env.example` for indexer with DATABASE_URL, RPC_URL, CHAIN, POLL_INTERVAL_MS.
4. Add documentation in api/README for prisma migrate/generate and seeding notes.
5. Add root-level npm scripts to run api + frontend concurrently and a lint aggregator.
6. Add lint/format configs and scripts for api (eslint + prettier minimal).
7. Add lint/format configs and scripts for indexer (eslint + prettier minimal).
8. Harden API validation schemas (Ethereum address checks, decimals, token symbols, slug rules, description limits).
9. Standardize API error responses (consistent shape, include error codes/messages).
10. Improve slug uniqueness handling with friendly error messages.
11. Add profile lookup by slug/alias endpoint and support query pagination for invoices.
12. Allow optional avatar/description fields on profiles in schema and API.
13. Add invoice expiry optional field to schema and API validation.
14. Update invoice model to store tokenAddress/decimals for ERC-20 support.
15. Implement indexer configuration for last-processed block cursor persisted in DB.
16. Implement basic viem RPC check for native transfers to receiveAddress since last cursor (happy-path only).
17. Add paidAt and txHash updates when indexer observes payment.
18. Add logging with correlation IDs/morgan tokens to API.
19. Add CORS tightening and rate-limit hook placeholder in API.
20. Update frontend dashboard to show loading/error states and surface pagination controls.
21. Add client-side form validation mirroring server rules with inline errors; show slug preview.
22. Enhance public invoice page with QR copy/download + copy-to-clipboard + status polling.
23. Add profile selector for invoice creation when multiple profiles exist.
24. Add API integration tests (Vitest + Supertest) for profile/invoice routes including validation failures.
25. Add frontend component tests (React Testing Library) for InvoiceForm and invoice page states.
26. Add Dockerfiles for api and frontend plus compose snippet for SQLite volume.
27. Add root docs on running combined dev stack and indexer, including env setup notes.
28. Add seed script or CLI to create profiles non-interactively for demos.
29. Ensure README and NEXT_STEPS updated to reflect new capabilities and remaining gaps.
30. Run lint/tests and ensure CI-ready scripts documented.
