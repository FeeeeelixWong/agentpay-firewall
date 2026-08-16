# AgentPay Firewall - Devpost Project Story

## Short Description

AgentPay Firewall is a policy wallet that lets AI agents pay for official x402 resources only within user-defined budgets, allowlists, risk limits, and approval rules.

## About The Project

### Inspiration

AI agents are moving from answering questions to taking paid actions: calling premium APIs, buying data, booking services, and paying other agents. x402 gives them an internet-native payment rail, but a payment rail alone does not answer the trust question: what is an autonomous agent actually allowed to buy?

AgentPay Firewall was built around a simple product belief: an agent wallet should be more than a signer. It should enforce a human-defined mandate before every payment authorization.

### What It Does

AgentPay Firewall sits between an AI agent and its wallet. It receives an official x402 `402 Payment Required` challenge, checks the payment against policy, and asks the wallet to sign only when the request is allowed.

The product supports three policy outcomes:

- **Allow:** create `PAYMENT-SIGNATURE`, retry the resource, and receive `PAYMENT-RESPONSE`.
- **Deny:** stop before the wallet is asked to sign.
- **Review:** pause a higher-value request for human approval.

### Direct x402 Integration

The public Vercel deployment exposes this official x402-protected resource:

```text
https://agentpay-firewall.vercel.app/api/x402/official
```

It uses `@x402/express` `paymentMiddleware`, `@x402/core` facilitator infrastructure, and the `@x402/evm` exact scheme. An unpaid request returns HTTP 402 with a standards-compliant x402 v2 `PAYMENT-REQUIRED` header for `0.001 USDC` on Base Sepolia.

The app places this protocol proof first. Evaluators can click **Verify official 402** without connecting a wallet, or run:

```bash
npm run smoke:x402
```

The test decodes the deployed challenge with `@x402/core/http` and verifies protocol version, scheme, network, amount, receiver, and resource binding.

### How We Built It

The implementation combines:

- React, TypeScript, and Vite for the product interface
- Vercel serverless functions for the public seller endpoint
- `@x402/express`, `@x402/core`, `@x402/evm`, and `@x402/fetch`
- OKX Wallet `eth_signTypedData_v4` authorization without exporting the buyer key
- a deterministic policy engine for budgets, allowlists, assets, networks, risk, and human approval
- automated unit, build, hosted x402, and payment lifecycle checks

The official buyer path has also completed a facilitator settlement for `0.001 USDC` on Base Sepolia:

https://sepolia.basescan.org/tx/0x322c19b1bc8e579e687e5cafdf7861ed5ebe47570b03a9ac0576dc128acdc6da

### Challenges

The hardest product challenge was separating two needs that can easily be confused. Judges need a deterministic way to explore allow, deny, and manual-review behavior without spending funds, while the submission also needs a genuine x402 integration. The final product therefore has two explicit layers: `/api/x402/official` for direct protocol verification and `/api/paid/*` only for policy simulations. The UI and documentation label them separately.

Wallet-network compatibility was another challenge. Base Sepolia is not always exposed as a selectable network in OKX Wallet. The buyer therefore requests the request-bound EIP-712 authorization from the wallet while the x402 facilitator performs the gasless settlement.

### What We Learned

The agent wallet itself is not the differentiator. The control plane is: standing mandates, pre-sign checks, clear refusal conditions, approval escalation, and evidence after every action.

Human wallet UX asks someone to inspect each popup. Agent payment UX needs enforceable rules that remain safe when no human is watching every request.

### What's Next

Next steps are durable policy storage, replay and idempotency records, smart-account or session-key enforcement, organization accounts, and packaging the policy engine as reusable middleware for x402 buyers and sellers.

## Built With

React, TypeScript, Vite, Vercel, Express, `@x402/express`, `@x402/core`, `@x402/evm`, `@x402/fetch`, OKX Wallet, Base Sepolia, and USDC.

## Links

- Live app: https://agentpay-firewall.vercel.app/
- Official x402 endpoint: https://agentpay-firewall.vercel.app/api/x402/official
- GitHub: https://github.com/FeeeeelixWong/agentpay-firewall
- Demo video: https://agentpay-firewall.vercel.app/agentpay-firewall-demo.mp4
- Settlement: https://sepolia.basescan.org/tx/0x322c19b1bc8e579e687e5cafdf7861ed5ebe47570b03a9ac0576dc128acdc6da
