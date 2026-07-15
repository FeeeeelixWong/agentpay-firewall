# AgentPay Firewall Architecture

AgentPay Firewall is built as a judge-safe implementation of an x402 policy wallet. The current deployment proves the HTTP payment lifecycle and policy controls without requiring judges to fund a wallet. This document describes what is live today and exactly where the demo components are replaced by official x402 infrastructure for production.

## What Runs Today

The production demo is deployed at:

```text
https://agentpay-firewall.vercel.app
```

The browser calls Vercel serverless routes under `/api/paid/*`. Those routes implement the same external shape that an x402-paid resource server exposes:

1. A buyer agent requests a paid resource.
2. The resource server returns HTTP `402` with a `PAYMENT-REQUIRED` header.
3. The policy wallet evaluates the payment requirement against user rules.
4. Only approved requests receive a `PAYMENT-SIGNATURE`.
5. The client retries the same resource with the signature header.
6. The resource server verifies the request-bound payload and returns `PAYMENT-RESPONSE` plus a receipt.

The demo policy layer checks:

- service allowlist
- max amount per request
- daily budget
- asset
- network
- risk score
- human approval threshold

The current receipt is a generated demo receipt, not an onchain settlement. That choice keeps the judge demo safe, fast, and free from external wallet/facilitator failure modes.

## Why This Is Not Just a Static Mock

The Vercel path uses live HTTP requests to serverless paid-resource routes. Judges can verify it with:

```bash
npm run smoke
```

The smoke test performs the complete hosted flow:

```text
GET /api/paid/allowed-risk-scan
<- 402 PAYMENT-REQUIRED
policy wallet creates PAYMENT-SIGNATURE
GET /api/paid/allowed-risk-scan with PAYMENT-SIGNATURE
<- 200 PAYMENT-RESPONSE + receipt
```

GitHub Pages is only a static fallback. The primary demo path is Vercel.

## Production Replacement Points

### 1. Resource Server

Current file:

```text
api/paid/[id].ts
```

Production replacement:

- Replace the hand-rolled challenge and settlement handler with official x402 middleware.
- For Express, the official seller quickstart currently uses `@x402/express`, `@x402/core`, `@x402/evm`, and `@x402/svm`.
- For Next.js/API routes, use the official x402 Next.js wrapper or a Vercel-compatible resource server wrapper.

The policy wallet remains upstream of signing. The resource server should not know private policy details; it only declares price, network, asset, destination, and resource metadata.

### 2. Payment Requirement Parsing

Current code decodes the `PAYMENT-REQUIRED` header into the local `PaymentRequirement` type.

Production replacement:

- Use official x402 v2 payment requirement types from `@x402/core`.
- Preserve CAIP-2 network identifiers such as `eip155:8453` for Base mainnet or `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp` for Solana mainnet.
- Keep the local policy evaluator as an additional guard before signing.

### 3. Wallet Signature

Current file:

```text
src/lib/protocol.ts
```

Current behavior:

- `createPaymentPayload` creates a demo signature.
- The payload is bound to requirement id, payment id, amount, asset, network, payer, service, resource, and policy decision id.

Production replacement:

- Replace the demo signer with an official x402 client.
- For fetch-based buyers, official docs currently point to `@x402/fetch` plus a registered payment scheme package such as `@x402/evm` or `@x402/svm`.
- For custom wallet flows, keep the policy engine as the gate, then call the x402 client only after policy returns `approved`.
- Store the policy decision id in local metadata so every payment can be traced back to the rule set that authorized it.

### 4. Facilitator Verification and Settlement

Current behavior:

- The server verifies the demo payload locally and creates a demo receipt.

Production replacement:

- Use an x402 facilitator for `/verify` and `/settle`, or settle directly against chain infrastructure.
- Official x402 docs describe the facilitator as the verification and settlement layer: it verifies the payment payload, submits valid payments onchain, monitors confirmation, and returns the payment execution result.
- For testnet, x402.org documents `https://x402.org/facilitator`.
- For production/mainnet, Coinbase Developer Platform documents `https://api.cdp.coinbase.com/platform/v2/x402` as a recommended facilitator endpoint.

### 5. Receipt and Explorer Evidence

Current behavior:

- The receipt includes `paymentId`, `settlementId`, `txHash`, `amountUsd`, `asset`, `network`, and `settledAt`.

Production replacement:

- Use the facilitator `PAYMENT-RESPONSE` as the source of truth.
- Persist raw facilitator response, normalized receipt, policy decision id, and resource id.
- Render an explorer link based on network:
  - Base mainnet: `https://basescan.org/tx/{txHash}`
  - Base Sepolia: `https://sepolia.basescan.org/tx/{txHash}`
  - Solana mainnet: `https://solscan.io/tx/{signature}`
  - Solana devnet: `https://solscan.io/tx/{signature}?cluster=devnet`

### 6. Replay Protection and Idempotency

Current behavior:

- The demo binds each signature to a specific resource and payment id.
- Tests prove a payload cannot be transplanted to another paid resource.

Production replacement:

- Persist payment ids and requirement digests.
- Reject reused signatures outside their original resource, amount, network, service, and expiration window.
- Add idempotency handling around facilitator settlement so a retry does not unlock multiple resources for one payment.
- For Solana/SVM flows, follow the official duplicate-settlement guidance and use the standard cache/idempotency helpers when using the official SVM facilitator packages.

### 7. Onchain Policy Enforcement

Current behavior:

- Policy is enforced offchain before signing.

Production replacement:

- Keep offchain policy for fast UX and explainability.
- Add smart accounts or session keys for hard onchain limits.
- Encode per-session spend caps, approved payees, approved assets, and expiration windows.
- Treat offchain policy as the human-readable decision layer and onchain controls as the hard safety layer.

## Production Milestones

1. Replace demo signer with official x402 client packages.
2. Replace serverless settlement simulation with facilitator-backed verify/settle.
3. Add a testnet funded wallet path for Base Sepolia or Solana Devnet.
4. Store policy decisions and facilitator receipts in durable storage.
5. Add explorer links to the receipt panel.
6. Add onchain-enforced limits via smart account/session key controls.

## References

- x402 introduction: https://docs.x402.org/introduction
- x402 facilitator concept: https://docs.x402.org/core-concepts/facilitator
- x402 seller quickstart: https://docs.x402.org/getting-started/quickstart-for-sellers
- Coinbase x402 migration/package reference: https://docs.cdp.coinbase.com/x402/migration-guide
- Coinbase x402 buyer quickstart and facilitator URLs: https://docs.cdp.coinbase.com/x402/quickstart-for-buyers
