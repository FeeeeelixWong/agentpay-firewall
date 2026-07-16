# AgentPay Firewall - Brainwave 2026 Submission

## Elevator Pitch

AgentPay Firewall is a policy wallet for AI agents: it lets agents pay for x402 resources, but only inside user-defined budgets, allowlists, risk limits, and human-approval rules.

## Judge Summary

x402 gives agents a native way to pay for internet resources. The missing layer is trust: if an AI agent can sign payments autonomously, who decides what it is allowed to buy, how much it can spend, and when a human must step in?

AgentPay Firewall answers that question. It sits between the agent and the signer, reads each `402 Payment Required` challenge, evaluates the payment against policy, signs only approved requests, and produces an auditable receipt trail for every allow, block, review, and settlement.

The project is not a static mock. It has a public Vercel demo for the full HTTP lifecycle, an official x402 seller harness, an OKX Wallet browser signer, and a verified Base Sepolia x402 facilitator settlement for `0.001 USDC`.

## What Is Live

The primary public demo is deployed on Vercel and uses serverless `/api/paid/*` resource routes. This is the first thing judges should evaluate: it runs a real hosted HTTP flow with `402`, `PAYMENT-REQUIRED`, policy approval, signed retry, and `PAYMENT-RESPONSE`.

1. The paid resource returns HTTP `402` with `PAYMENT-REQUIRED`.
2. The policy wallet evaluates amount, daily budget, service allowlist, asset, network, and risk score.
3. The wallet creates `PAYMENT-SIGNATURE` only for approved requests.
4. The client retries the same paid resource.
5. The server verifies the request-bound payment payload and returns `PAYMENT-RESPONSE` plus a settlement receipt.

The public receipt is explicitly marked `demo-facilitator` and `onchain: false`, because the default judge demo should be safe, deterministic, and usable without funded wallets. The repo also includes the production-like path:

- `server/x402-official.ts`: official `@x402/express` seller middleware with `x402ResourceServer`, `ExactEvmScheme`, and `HTTPFacilitatorClient`.
- `src/lib/okx-wallet.ts`: browser buyer path that connects the OKX Wallet extension, signs the official x402 EIP-712 payload with `eth_signTypedData_v4`, retries with `PAYMENT-SIGNATURE`, and decodes `PAYMENT-RESPONSE`.
- `scripts/x402-official-readiness.ts`: proves the official SDK path loads and reports missing funded-wallet env.
- `scripts/x402-official-challenge.ts`: asserts the official protected route returns `402` and a decodable x402 `PAYMENT-REQUIRED`.
- `scripts/x402-official-pay.ts`: optional CLI buyer harness using official `@x402/fetch` for automated private-key test runs.

The GitHub Pages mirror is a static fallback only. The Vercel deployment is the judge-facing path for the hosted HTTP transport demo. The OKX Wallet browser path is the production-like settlement path: the buyer key never leaves the wallet extension, and the app only receives a signed x402 payment header and the facilitator receipt.

Verified real x402 settlement evidence:

- Network: Base Sepolia (`eip155:84532`)
- Payer: `0x0934146ca4f8e611da0ef8bd295ee9f7e34741fe`
- Pay to: `0x4a6aae28b27681856ae824af82fea87896ecc3ed`
- Asset: USDC (`0x036CbD53842c5426634e7929541eC2318f3dCF7e`)
- Amount: `0.001 USDC`
- Transaction: https://sepolia.basescan.org/tx/0x322c19b1bc8e579e687e5cafdf7861ed5ebe47570b03a9ac0576dc128acdc6da
- Evidence file: [docs/x402-settlement-evidence.json](docs/x402-settlement-evidence.json)

## About the Project

### Inspiration

AI agents are moving from answering questions to taking paid actions: calling premium APIs, buying data, paying tools, booking services, and eventually paying other agents. x402 makes the payment rail feel native to the internet, but raw signing power is too dangerous for autonomous software.

AgentPay Firewall was built around a simple product belief: the future agent wallet is not just a signer. It is a mandate engine. Agents should be able to pay, but only inside constraints the user can understand, inspect, and revoke.

### What It Does

AgentPay Firewall sits between an AI agent and an x402 signer.

When an agent requests a paid resource, the resource server returns a `402 Payment Required` response with a `PAYMENT-REQUIRED` header. The wallet decodes the challenge, evaluates it against policy, and only signs if the request is allowed.

The demo supports three flows:

- **Allowed paid API**: the agent buys a small allowlisted API call and receives a settlement receipt.
- **Blocked overspend**: the agent tries to buy an expensive non-allowlisted data crawl and is blocked before signing.
- **Manual review**: the agent requests an allowlisted resource above the human-approval threshold.

The core user experience is deliberately simple: "this agent may buy this kind of resource, up to this amount, on this network, unless risk or spend crosses a line." That is the trust primitive agentic commerce needs before autonomous payments can become normal.

### How It Uses x402

The implementation demonstrates the x402 lifecycle:

1. **Challenge**: paid resource returns HTTP `402` and `PAYMENT-REQUIRED`.
2. **Policy Check**: wallet evaluates amount, daily budget, allowlist, asset, network, and risk score.
3. **Sign**: wallet creates `PAYMENT-SIGNATURE` only if policy allows it.
4. **Retry**: client retries the same paid resource with the signed payload.
5. **Settle**: server verifies the payment payload and returns `PAYMENT-RESPONSE`.

The Vercel/serverless and local implementations include a real `/api/paid/*` resource server. The official production harness additionally uses `@x402/express`, `@x402/evm`, and `@x402/core` for Base Sepolia/CDP-ready settlement, with an OKX Wallet extension buyer that signs the x402 typed data in-browser when the wallet accepts the challenge network. The GitHub Pages mirror uses a browser fallback because GitHub Pages cannot run serverless API routes; it is clearly labeled in the UI.

The verified settlement proves the path end-to-end: OKX Wallet signed the request-bound x402 authorization, the facilitator settled it, and Base Sepolia recorded a `0.001 USDC` transfer to the receiving wallet.

### What Makes It Different

Most agent payment demos focus on whether the agent can pay. AgentPay Firewall focuses on whether the agent should be allowed to pay.

That difference matters. Payment rails unlock autonomy, but policy unlocks adoption: teams will not let agents spend from real wallets unless there is a clear control plane for budgets, allowlists, risky endpoints, audit logs, and approval thresholds.

The signature payload is request-bound: it includes the resource, service, payment id, amount, asset, network, payer, and policy decision id. A signature for one paid resource cannot be transplanted to another scenario in the tests.

### Challenges

The main challenge was designing a demo that is understandable to judges while still showing the real protocol shape. A full onchain x402 facilitator run requires funded wallets and external settlement infrastructure, which is risky for a default public demo. The project therefore separates the experience into two layers: a safe Vercel flow that anyone can try, and a verified official x402 + OKX Wallet settlement path for proof.

Another challenge was wallet-network compatibility. OKX Wallet does not list Base Sepolia as a normal selectable network, so the product treats chain switching as optional and uses OKX for the part that matters to x402 exact payments: request-bound typed-data signing. The facilitator then performs the gasless settlement.

### What I Learned

Agentic payments need a wallet, but the wallet is not the product moat. The moat is the policy layer: budgets, allowlists, intent binding, audit logs, and clear human override points.

The most important learning from building this was that payment UX for agents cannot look like consumer wallet UX. Humans approve a transaction by inspecting a screen. Agents need a standing mandate, runtime checks, and evidence after every action.

### What's Next

- Add persistent policy storage and replay protection.
- Support smart accounts/session keys for onchain-enforced limits.
- Add merchant and agent reputation.
- Turn the audit log into exportable receipts for teams.
- Package the policy engine as middleware so any x402 seller or agent framework can integrate it quickly.

## Links

- Public demo: https://agentpay-firewall.vercel.app/
- Demo video with English voiceover: https://agentpay-firewall.vercel.app/agentpay-firewall-demo.mp4
- Verified x402 settlement: https://sepolia.basescan.org/tx/0x322c19b1bc8e579e687e5cafdf7861ed5ebe47570b03a9ac0576dc128acdc6da
- Static fallback demo: https://feeeeelixwong.github.io/agentpay-firewall/
- GitHub: https://github.com/FeeeeelixWong/agentpay-firewall

## Notes for Judges

The public Vercel demo is the primary judge-facing build and runs the serverless paid resource API. To verify the complete hosted flow from the command line:

```bash
npm install
npm run smoke
```

`npm run smoke` defaults to `https://agentpay-firewall.vercel.app` and verifies `402 -> PAYMENT-REQUIRED -> PAYMENT-SIGNATURE -> paid retry -> PAYMENT-RESPONSE`.

To verify the official x402 SDK/facilitator path:

```bash
npm run x402:ready
X402_PAY_TO=0xYourReceivingWallet npm run dev:x402
npm run x402:challenge
```

Then verify it as a product user with OKX Wallet:

```bash
npm run dev:web
```

Open `http://127.0.0.1:5176`, connect OKX Wallet, and click **Sign x402 with OKX**. The UI shows the official `PAYMENT-REQUIRED`, generated `PAYMENT-SIGNATURE`, facilitator `PAYMENT-RESPONSE`, and explorer-linked receipt when the facilitator returns a transaction hash. This path does not require exporting a buyer private key.

Important wallet compatibility note: OKX Wallet's documented network list includes Base mainnet (`eip155:8453`) but not Base Sepolia (`eip155:84532`). The browser path therefore does not force a Base Sepolia chain switch; it asks OKX to sign the EIP-712 x402 authorization directly. If the installed wallet build refuses unknown-chain typed data, use the CLI Base Sepolia harness below or point `VITE_X402_TARGET_URL` at an OKX-supported mainnet x402 resource.

For automated CLI regression testing, a funded private-key buyer can also run:

```bash
X402_EVM_PRIVATE_KEY=0xYourFundedBuyerKey npm run x402:pay
```

Defaults are Base Sepolia (`eip155:84532`) and `https://x402.org/facilitator`. Mainnet/CDP can be selected with `X402_MODE=mainnet`, `X402_NETWORK=eip155:8453`, `X402_FACILITATOR_URL=https://api.cdp.coinbase.com/platform/v2/x402`, `CDP_API_KEY_ID`, and `CDP_API_KEY_SECRET`.

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

Production architecture notes are in [ARCHITECTURE.md](ARCHITECTURE.md), including the official x402 SDK/facilitator path for real signatures, verification, settlement, and explorer-linked receipts.
