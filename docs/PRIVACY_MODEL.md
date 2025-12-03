# Privacy model

CloakLink separates your public identity from the wallet receiving payments.

## Guarantees
- Non-custodial: payments go directly on-chain to your provided address.
- In Simple Mode, invoices use a dedicated receive wallet distinct from your main identity.
- Public invoice pages avoid revealing your main ENS or historical balances.

## Non-goals / limitations
- No mixing or laundering of funds.
- Chain analysis can still link all Simple Mode invoices to the same receive address.
- Payers can share invoice URLs; access control is intentionally open for public payment links.
- Indexer currently relies on a placeholder check (marks paid when `txHash` is set); production deployments should add RPC-based detection.

## Future improvements
- Stealth/derived mode with per-invoice addresses derived from a client-held seed.
- Optional notifications when invoices are paid.
- Stronger verification of chain receipts across multiple networks.
