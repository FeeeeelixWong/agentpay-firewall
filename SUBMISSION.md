# AgentPay Firewall - Brainwave 2026 Submission

## Elevator Pitch

AgentPay Firewall is a policy wallet for AI agents that enforces budgets, allowlists, risk checks, and human-approval thresholds before signing x402 payments.

## What Is Live

The primary public demo is deployed on Vercel and uses serverless `/api/paid/*` resource routes, not a static mock. Judges can open the app and run the full browser-visible flow:

1. The paid resource returns HTTP `402` with `PAYMENT-REQUIRED`.
2. The policy wallet evaluates amount, daily budget, service allowlist, asset, network, and risk score.
3. The wallet creates `PAYMENT-SIGNATURE` only for approved requests.
4. The client retries the same paid resource.
5. The server verifies the request-bound payment payload and returns `PAYMENT-RESPONSE` plus a settlement receipt.

The GitHub Pages mirror is a static fallback only. The Vercel deployment is the judge-facing path for the real HTTP transport demo.

## About the Project

### Inspiration

AI agents are moving from answering questions to taking paid actions: calling premium APIs, buying data, paying tools, and eventually paying other agents. x402 makes the payment rail feel native to the internet, but raw signing power is too dangerous for autonomous software.

AgentPay Firewall was built around a simple product belief: agents should be able to pay, but only inside a user-defined mandate.

### What It Does

AgentPay Firewall sits between an AI agent and an x402 signer.

When an agent requests a paid resource, the resource server returns a `402 Payment Required` response with a `PAYMENT-REQUIRED` header. The wallet decodes the challenge, evaluates it against policy, and only signs if the request is allowed.

The demo supports three flows:

- **Allowed paid API**: the agent buys a small allowlisted API call and receives a settlement receipt.
- **Blocked overspend**: the agent tries to buy an expensive non-allowlisted data crawl and is blocked before signing.
- **Manual review**: the agent requests an allowlisted resource above the human-approval threshold.

### How It Uses x402

The implementation demonstrates the x402 lifecycle:

1. **Challenge**: paid resource returns HTTP `402` and `PAYMENT-REQUIRED`.
2. **Policy Check**: wallet evaluates amount, daily budget, allowlist, asset, network, and risk score.
3. **Sign**: wallet creates `PAYMENT-SIGNATURE` only if policy allows it.
4. **Retry**: client retries the same paid resource with the signed payload.
5. **Settle**: server verifies the payment payload and returns `PAYMENT-RESPONSE`.

The Vercel/serverless and local implementations include a real `/api/paid/*` resource server. The GitHub Pages mirror uses a browser fallback because GitHub Pages cannot run serverless API routes; it is clearly labeled in the UI.

### What Makes It Different

Most agent payment demos focus on whether the agent can pay. AgentPay Firewall focuses on whether the agent should be allowed to pay.

The signature payload is request-bound: it includes the resource, service, payment id, amount, asset, network, payer, and policy decision id. A signature for one paid resource cannot be transplanted to another scenario in the tests.

### Challenges

The main challenge was designing a demo that is understandable to judges while still showing the real protocol shape. A full onchain x402 facilitator integration requires funded wallets and external settlement infrastructure, which is risky for a judge-facing demo. This MVP keeps the protocol headers, payment lifecycle, signature verification, and policy decisions visible while keeping the demo safe and deterministic.

### What I Learned

Agentic payments need a wallet, but the wallet is not the product moat. The moat is the policy layer: budgets, allowlists, intent binding, audit logs, and clear human override points.

### What's Next

- Connect to the official x402 TypeScript SDK and facilitator.
- Add persistent policy storage and replay protection.
- Support smart accounts/session keys for onchain-enforced limits.
- Add merchant and agent reputation.
- Turn the audit log into exportable receipts for teams.

## Links

- Public demo: https://agentpay-firewall.vercel.app/
- Demo video with English voiceover: https://agentpay-firewall.vercel.app/agentpay-firewall-demo.mp4
- Static fallback demo: https://feeeeelixwong.github.io/agentpay-firewall/
- GitHub: https://github.com/FeeeeelixWong/agentpay-firewall

## Notes for Judges

The public Vercel demo is the primary judge-facing build and runs the serverless paid resource API. To verify the complete hosted flow from the command line:

```bash
npm install
npm run smoke
```

`npm run smoke` defaults to `https://agentpay-firewall.vercel.app` and verifies `402 -> PAYMENT-REQUIRED -> PAYMENT-SIGNATURE -> paid retry -> PAYMENT-RESPONSE`.

To verify the same flow locally:

```bash
npm install
npm run dev
```

Then open:

```text
http://127.0.0.1:5176
```

The local API returns real `402` responses with `PAYMENT-REQUIRED` headers at:

```text
http://127.0.0.1:8787/api/paid/allowed-risk-scan
```

Local validation:

```bash
npm test
npm run build
BASE_URL=http://127.0.0.1:8787 npm run smoke
```

Production architecture notes are in [ARCHITECTURE.md](ARCHITECTURE.md), including the official x402 SDK/facilitator replacement path for real signatures, verification, settlement, and explorer-linked receipts.
