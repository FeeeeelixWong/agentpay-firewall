# AgentPay Firewall - Devpost Project Story

## Short Description

AgentPay Firewall is a policy wallet for AI agents: it lets agents pay for x402 resources, but only inside user-defined budgets, allowlists, risk limits, and human-approval rules.

## About The Project

### Inspiration

AI agents are starting to move from answering questions to taking paid actions: calling premium APIs, buying data, booking services, paying tools, and eventually paying other agents. x402 gives those agents a native internet payment rail. But a payment rail alone is not enough.

The hard question is trust. If an autonomous agent can sign payments, who decides what it is allowed to buy, how much it can spend, and when a human needs to step in? AgentPay Firewall was built around a simple belief: the future agent wallet is not just a signer. It is a mandate engine.

### What It Does

AgentPay Firewall sits between an AI agent and an x402 signer.

When an agent requests a paid resource, the resource server returns `402 Payment Required` with a `PAYMENT-REQUIRED` header. AgentPay Firewall decodes the challenge, checks it against policy, and only creates `PAYMENT-SIGNATURE` when the request is allowed.

The demo shows three core flows:

- An allowlisted agent buys a small paid API call and receives a settlement receipt.
- A costly, non-allowlisted request is blocked before signing.
- A higher-value allowlisted request is routed to manual review.

The product also includes an official x402 path with OKX Wallet typed-data signing and a verified Base Sepolia facilitator settlement for `0.001 USDC`.

### How We Built It

The public demo is deployed on Vercel and uses serverless `/api/paid/*` routes to show the full HTTP lifecycle:

```text
402 challenge -> PAYMENT-REQUIRED -> policy check -> PAYMENT-SIGNATURE -> retry -> PAYMENT-RESPONSE
```

The production-like path uses:

- `@x402/express` for the official x402 seller middleware
- `@x402/core` and `@x402/evm` for the official challenge, signer, and facilitator flow
- OKX Wallet extension signing via `eth_signTypedData_v4`
- A request-bound policy payload with service, amount, asset, network, resource, payer, and policy decision id

The verified settlement evidence is here:

```text
https://sepolia.basescan.org/tx/0x322c19b1bc8e579e687e5cafdf7861ed5ebe47570b03a9ac0576dc128acdc6da
```

### Challenges

The biggest challenge was making the project both judge-safe and technically honest. A public demo that spends real funds on every click is fragile, but a pure mock is not convincing. The final architecture separates those concerns: the Vercel demo is deterministic and safe, while the official x402 + OKX Wallet path proves real settlement with chain evidence.

Another challenge was wallet-network compatibility. OKX Wallet does not list Base Sepolia as a normal selectable network, so the browser signer path does not force a chain switch. It uses OKX Wallet for the part x402 exact payments need from the buyer: request-bound EIP-712 authorization. The facilitator then performs the gasless settlement.

### What We Learned

Agentic payments need wallets, but the wallet is not the moat. The policy layer is the moat.

Humans approve one transaction at a time by reading a wallet popup. Agents need a different model: a standing mandate, runtime checks, clear refusal conditions, and an audit trail after every action. That is the layer AgentPay Firewall explores.

### What's Next

Next steps are persistent policy storage, replay protection, smart-account or session-key enforcement, merchant and agent reputation, and packaging the policy engine as middleware that any x402 seller or agent framework can adopt.

## Built With

React, TypeScript, Vite, Node.js, Vercel, `@x402/express`, `@x402/core`, `@x402/evm`, `@x402/fetch`, OKX Wallet, Base Sepolia, USDC.
