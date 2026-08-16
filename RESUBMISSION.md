# Brainwave 2026 Algorand Final-Round Proof

## Project

**Name:** AgentPay Firewall

**Track:** Algorand x402 Blockchain Track

**Live project:** https://agentpay-firewall.vercel.app/

**Source:** https://github.com/FeeeeelixWong/agentpay-firewall

## Required Correction

The primary public seller now runs x402 on Algorand Testnet:

```text
https://agentpay-firewall.vercel.app/api/x402/official
```

It uses `@x402/express` payment middleware, `@x402/core` facilitator infrastructure, `@x402/avm`, Algorand Testnet USDC ASA `10458941`, and GoPlausible. The relevant dependencies are declared in `package.json`.

## How To Verify

### Hosted challenge

```bash
npm install
npm run smoke:x402
```

The smoke test asserts HTTP 402, x402 version 2, exact scheme, Algorand Testnet, ASA `10458941`, amount `1000`, Seller address, and resource binding.

### Product flow

1. Open the live app.
2. Click **Verify official 402**.
3. Connect Pera Wallet on Testnet.
4. Run the policy check before signing.
5. Approve the `0.001 USDC` payment.
6. Inspect the returned transaction in Lora.

## Implementation Files

- Algorand seller: [`api/x402/official.ts`](api/x402/official.ts)
- AVM configuration: [`src/lib/x402-algorand.ts`](src/lib/x402-algorand.ts)
- Pera buyer: [`src/lib/algorand-wallet.ts`](src/lib/algorand-wallet.ts)
- Hosted smoke: [`scripts/x402-hosted-smoke.ts`](scripts/x402-hosted-smoke.ts)
- Automated payer: [`scripts/x402-algorand-pay.ts`](scripts/x402-algorand-pay.ts)

## Accuracy Note

`/api/x402/official` is the required Algorand integration. `/api/paid/*` is only a deterministic policy simulator. `/api/x402/base` preserves the prior EVM route but is not claimed as final-round Algorand evidence.
