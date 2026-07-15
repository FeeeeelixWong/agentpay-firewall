# AgentPay Firewall - Brainwave 2026 Submission

## Elevator Pitch

AgentPay Firewall is a policy wallet for AI agents that enforces budgets, allowlists, risk checks, and human-approval thresholds before signing x402 payments.

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
- Demo video: https://agentpay-firewall.vercel.app/agentpay-firewall-demo.mp4
- Static fallback demo: https://feeeeelixwong.github.io/agentpay-firewall/
- GitHub: https://github.com/FeeeeelixWong/agentpay-firewall

## Notes for Judges

The public GitHub Pages demo is optimized for one-click judging and uses a static fallback for the transport layer. To verify the real API flow locally:

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

Validation:

```bash
npm test
npm run build
npm run smoke
```
