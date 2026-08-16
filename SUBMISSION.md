# AgentPay Firewall - Brainwave 2026 Resubmission

## Correction Implemented

AgentPay Firewall now directly integrates x402 in the public Vercel deployment.

The protected seller endpoint is:

```text
https://agentpay-firewall.vercel.app/api/x402/official
```

An unpaid request returns HTTP `402` plus an official x402 v2 `PAYMENT-REQUIRED` challenge. The endpoint is implemented with `@x402/express` `paymentMiddleware`, `@x402/core` `HTTPFacilitatorClient`, and the `@x402/evm` exact scheme. It targets Base Sepolia and the public x402.org facilitator.

This correction replaces the earlier presentation in which a custom judge-safe payment simulation appeared to be the primary integration. The simulation remains only for deterministic policy examples and is clearly labeled separately. The judge-facing proof is now the hosted official route.

## 60-Second Evaluator Flow

1. Open https://agentpay-firewall.vercel.app/.
2. Click **Verify official 402** in the first panel.
3. Confirm the UI reports `Official x402 verified` and shows the decoded challenge.
4. Open the [official endpoint](https://agentpay-firewall.vercel.app/api/x402/official) directly and inspect the HTTP 402 response.
5. Run an allowed, denied, or manual-review policy scenario below the protocol proof panel.
6. Inspect the [verified settlement transaction](https://sepolia.basescan.org/tx/0x322c19b1bc8e579e687e5cafdf7861ed5ebe47570b03a9ac0576dc128acdc6da).

CLI verification:

```bash
npm install
npm run smoke:x402
```

The smoke test fails unless the deployed endpoint returns HTTP 402, exposes a decodable `PAYMENT-REQUIRED`, advertises the exact EVM scheme, and binds the challenge to the requested resource.

## Product

AgentPay Firewall is a policy wallet for AI agents. It lets an agent pay for x402 resources only when the request satisfies user-defined budgets, service allowlists, network and asset restrictions, risk limits, and approval rules.

The flow is:

```text
paid resource request
-> official 402 + PAYMENT-REQUIRED
-> pre-sign policy decision
-> OKX Wallet PAYMENT-SIGNATURE when allowed
-> retry
-> facilitator settlement
-> PAYMENT-RESPONSE + receipt
```

Denied requests stop before wallet signing. Higher-value requests pause for human review.

## Direct x402 Evidence

| Evidence | Value |
| --- | --- |
| Live resource | https://agentpay-firewall.vercel.app/api/x402/official |
| Protocol | x402 v2 |
| Scheme | exact |
| Network | Base Sepolia (`eip155:84532`) |
| Price | `0.001 USDC` |
| Facilitator | https://x402.org/facilitator |
| Seller middleware | `@x402/express` |
| Buyer implementation | `@x402/core`, `@x402/evm`, OKX Wallet |
| Automated verification | `npm run smoke:x402` |

## Real Settlement Evidence

The official buyer path has completed an onchain facilitator settlement:

- Status: `settled`
- Payer: `0x0934146ca4f8e611da0ef8bd295ee9f7e34741fe`
- Pay to: `0x4a6aae28b27681856ae824af82fea87896ecc3ed`
- Amount: `0.001 USDC`
- Transaction: https://sepolia.basescan.org/tx/0x322c19b1bc8e579e687e5cafdf7861ed5ebe47570b03a9ac0576dc128acdc6da
- Evidence: [docs/x402-settlement-evidence.json](docs/x402-settlement-evidence.json)

## Links

- Live app: https://agentpay-firewall.vercel.app/
- Official x402 endpoint: https://agentpay-firewall.vercel.app/api/x402/official
- Source: https://github.com/FeeeeelixWong/agentpay-firewall
- Demo video: https://agentpay-firewall.vercel.app/agentpay-firewall-demo.mp4
- Architecture: [ARCHITECTURE.md](ARCHITECTURE.md)
- Resubmission proof: [RESUBMISSION.md](RESUBMISSION.md)

## Readiness Checklist

- [x] Direct official x402 integration is deployed in the public project.
- [x] The endpoint returns an official, decodable `PAYMENT-REQUIRED` challenge.
- [x] The app surfaces protocol verification before simulation controls.
- [x] A real Base Sepolia x402 settlement has explorer evidence.
- [x] Automated tests cover configuration and hosted challenge validation.
- [x] The project, endpoint, source, evidence, and demo links are public.
