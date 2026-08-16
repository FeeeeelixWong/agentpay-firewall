# Brainwave 2026 Resubmission Proof

## Project

**Name:** AgentPay Firewall  
**Track:** x402 Blockchain Track  
**Live project:** https://agentpay-firewall.vercel.app/  
**Source:** https://github.com/FeeeeelixWong/agentpay-firewall

## Required Correction

The project now directly integrates official x402 middleware in its public deployment. The new protected endpoint is:

```text
https://agentpay-firewall.vercel.app/api/x402/official
```

It uses `@x402/express` payment middleware, `@x402/core` facilitator infrastructure, and the `@x402/evm` exact scheme. An unpaid GET returns HTTP 402 with a standards-compliant x402 v2 `PAYMENT-REQUIRED` header. A valid `PAYMENT-SIGNATURE` is verified and settled through the configured facilitator before the resource is returned with `PAYMENT-RESPONSE`.

## How To Verify

### In the product

1. Open the live project.
2. Click **Verify official 402**.
3. Confirm the status changes to **Official x402 verified**.
4. Review the decoded protocol details: x402 v2, exact, Base Sepolia, 0.001 USDC.

### From the repository

```bash
npm install
npm run smoke:x402
```

The check asserts the deployed endpoint's HTTP status, official header, protocol version, payment option, and resource binding.

### Onchain proof

The browser buyer path has already completed an official settlement signed by OKX Wallet:

https://sepolia.basescan.org/tx/0x322c19b1bc8e579e687e5cafdf7861ed5ebe47570b03a9ac0576dc128acdc6da

## Implementation Files

- Hosted seller: [`api/x402/official.ts`](api/x402/official.ts)
- Hosted verification: [`scripts/x402-hosted-smoke.ts`](scripts/x402-hosted-smoke.ts)
- Buyer wallet: [`src/lib/okx-wallet.ts`](src/lib/okx-wallet.ts)
- Official client configuration: [`src/lib/x402-official.ts`](src/lib/x402-official.ts)
- Settlement evidence: [`docs/x402-settlement-evidence.json`](docs/x402-settlement-evidence.json)

## Accuracy Note

The official x402 endpoint and deterministic policy simulator are separate and clearly labeled. `/api/x402/official` is the direct x402 integration. `/api/paid/*` exists only to demonstrate allow, deny, and manual-review policy outcomes without spending evaluator funds.
