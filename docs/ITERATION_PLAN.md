# Iteration 3 Plan - Solana Pivot

Numbered checklist of granular tasks for the Solana refactor and indexer build. Update this file after each task is completed.

1. [x] Confirm repository status and note pending files for Solana pivot.
2. [x] Review api/src/server.ts for Ethereum-specific validation usage.
3. [x] Review frontend/src/components/InvoiceForm.tsx validation logic for addresses.
4. [x] Review indexer/src/index.ts for existing EVM logic and identify replacement needs.
5. [x] Draft Solana address validation helper approach (web3.js or regex) for API.
6. [x] Update Zod validation in api/src/server.ts to use Solana address validation utility.
7. [x] Ensure Profile schema allows Solana addresses (32-44 Base58 characters) only.
8. [x] Ensure Invoice schema allows Solana addresses and token mint fields appropriately.
9. [x] Remove ethAddressRegex and any Ethereum references in api/src/server.ts.
10. [x] Verify API default error messages remain coherent after Solana validation changes.
11. [x] Update api/.env.example defaults to Solana network and sample addresses.
12. [x] Update frontend/.env.local.example (or equivalent) defaults to Solana chain values.
13. [x] Adjust frontend InvoiceForm validation to reject 0x addresses and accept Base58.
14. [x] Rename or clarify frontend token/mint labels to indicate SPL Token mint where relevant.
15. [x] Run frontend type check or build to ensure validation changes compile.
16. [x] Add @solana/web3.js dependency to indexer workspace.
17. [x] Plan Solana indexer flow using getSignaturesForAddress and getParsedTransaction.
18. [x] Implement Solana RPC connection setup in indexer/src/index.ts.
19. [x] Implement signature cursor persistence (e.g., file or DB) for last processed signature.
20. [x] Implement polling loop to fetch new signatures for target invoice addresses.
21. [x] Implement SOL transfer detection via postBalances or parsed instructions.
22. [x] Implement SPL token transfer detection via postTokenBalances.
23. [x] Update invoice status to PAID and record tx details when matches occur.
24. [x] Add basic logging for indexer processing steps and cursor updates.
25. [x] Ensure indexer respects POLL_INTERVAL_MS and handles empty results gracefully.
26. [x] Create integration test ensuring profile creation accepts valid Solana address.
27. [x] Verify npm run dev (or equivalent) works without Ethereum env requirements.
28. [x] Run lint/tests where available and note outcomes.
29. [x] Review documentation/readme for Ethereum references needing Solana updates.
30. [x] Prepare git commit with Solana refactor and indexer implementation.
31. [x] Prepare git commit for tests/hygiene updates if separate.
32. [x] Summarize changes and ensure ITERATION_PLAN reflects final task statuses.
