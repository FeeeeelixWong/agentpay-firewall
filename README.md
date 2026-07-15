# AgentPay Firewall

AgentPay Firewall is a hackathon MVP for the Brainwave 2026 X402 Blockchain Track.

It demonstrates a policy wallet for AI agents:

- a resource server returns an HTTP `402` challenge with `PAYMENT-REQUIRED`
- the agent wallet checks budget, allowlist, asset, network, and risk rules
- only approved requests receive a `PAYMENT-SIGNATURE`
- the client retries the paid request
- the resource server verifies the payload and returns `PAYMENT-RESPONSE`
- every approval, block, review, and settlement is shown in the audit log

The demo uses an x402-shaped local simulator so judges can run the full Challenge -> Sign -> Retry -> Settle flow without funding a wallet. The production path is to replace the demo signer/facilitator with the official `@x402/fetch`, `@x402/express`, and chain-specific signing packages.

## Quick Start

```bash
npm install
npm run dev
```

Open:

```text
http://127.0.0.1:5176
```

The local API runs on:

```text
http://127.0.0.1:8787
```

The repo also includes Vercel serverless API routes under `api/` so the same UI can run as a deployed public demo.

## Demo Flow

1. Run **Allowed paid API**.
2. The server returns `402 Payment Required` and a `PAYMENT-REQUIRED` header.
3. The policy wallet approves the request because it is allowlisted and under budget.
4. The wallet signs a `PAYMENT-SIGNATURE`.
5. The client retries the request.
6. The server verifies and settles, then returns `PAYMENT-RESPONSE`.
7. Run **Blocked overspend** to show that the wallet refuses before signing.
8. Run **Manual review** to show a human approval path for higher-value requests.

## Why It Matters

AI agents need to pay for APIs, data, tools, and other agents. Raw signing power is too dangerous, and manual approval for every micropayment removes the value of agent autonomy.

AgentPay Firewall inserts a policy layer between the agent and the x402 signer. The agent can act, but only inside a user-defined mandate.

## Screenshots

![Settled x402 payment](docs/media/agentpay-settled-3x2.png)

![Blocked payment before signing](docs/media/agentpay-blocked-3x2.png)

## Built With

- React
- TypeScript
- Vite
- Node.js local HTTP server
- x402-style payment headers

## Tests

```bash
npm test
npm run build
```
