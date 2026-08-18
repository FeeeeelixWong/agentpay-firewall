# AgentPay Firewall - Devpost Project Story

## Short Description

AgentPay Firewall lets a Seller create a protected Algorand x402 payment link and lets a Buyer review, authorize, and verify the resulting payment without giving up wallet custody.

## Inspiration

x402 makes paid API access programmable, but a fixed-price endpoint is still developer infrastructure. Real users need a product layer: the Seller must decide how much to charge and where funds should go, while the Buyer must understand the exact terms before a wallet asks for approval.

AgentPay Firewall was rebuilt around that missing interaction. The Seller creates the payment request. The Buyer receives one signed checkout link. The x402 challenge and final receipt must agree with those terms.

## What It Does

AgentPay Firewall has two focused experiences:

- **Seller workspace:** set a title, USDC amount, Algorand Testnet receiving address, and description; then create a 7-day payment link.
- **Buyer checkout:** verify the signed request, review amount, recipient, network, and expiry, then connect Pera Wallet.

The server signs each request with HMAC. Editing the token, amount, or recipient invalidates the link. A valid checkout maps to a dynamic x402 resource whose `PAYMENT-REQUIRED` challenge is generated from the same signed terms.

## Direct x402 Integration

The dynamic protected resource is:

```text
https://agentpay-firewall.vercel.app/api/x402/pay?request=<signed-token>
```

It uses `@x402/express`, `@x402/core`, and the `@x402/avm` exact scheme. An unpaid request returns HTTP `402` with an x402 v2 `PAYMENT-REQUIRED` challenge for Algorand Testnet USDC ASA `10458941`. Verification and settlement are routed through GoPlausible.

The hosted checkout smoke creates a real Seller request, resolves the Buyer link, decodes the deployed challenge, verifies amount, recipient, network, scheme, and asset, and proves that a tampered token is rejected:

```bash
npm run smoke:checkout
```

## How We Built It

- React, TypeScript, and Vite for the Seller and Buyer experiences
- Vercel serverless functions for payment-link creation and x402 resources
- HMAC-SHA256 signed, expiring payment request tokens
- `@x402/express`, `@x402/core`, `@x402/avm`, and `@x402/fetch`
- Pera Wallet for Buyer-owned authorization
- GoPlausible for AVM verification and settlement
- Vitest plus hosted checkout and x402 smoke tests

## Verified Settlement

The official AVM settlement path has already completed on Algorand Testnet. A funded Pera Buyer paid `0.001 USDC` through GoPlausible, and the payment confirmed at round `66373009`.

Verified transaction: [`SEQAUK2K5SHHLUA35273OWDNCXXWVODYUUKPZUHQ6JZ2WPQEQWDQ`](https://lora.algokit.io/testnet/transaction/SEQAUK2K5SHHLUA35273OWDNCXXWVODYUUKPZUHQ6JZ2WPQEQWDQ)

This receipt proves live settlement for the same Algorand network, USDC asset, amount, and Seller address used by the product demo. The dynamic Seller-link route is independently proven by the hosted checkout smoke and mismatch assertions.

## Challenges

The largest change was moving from an engineer-facing policy dashboard to a user-facing payment product without weakening the protocol proof. The new interface had to keep Seller configuration, Buyer review, wallet custody, dynamic `402` generation, and receipt evidence understandable as one flow.

Another challenge was preserving a strict trust boundary. AgentPay never receives a private key, never signs on behalf of the Buyer, and rejects a challenge if it differs from the Seller-signed request.

## What We Learned

Protocol correctness is necessary but not sufficient. The product becomes understandable only when pricing intent, Buyer consent, and settlement evidence are shown as one continuous experience.

## What's Next

Next steps are persistent Seller accounts, reusable checkout templates, payment status webhooks, idempotency records, receipt history, production Algorand Mainnet configuration, and optional policy mandates for autonomous agent buyers.

## Built With

React, TypeScript, Vite, Vercel, Express, HMAC-SHA256, `@x402/express`, `@x402/core`, `@x402/avm`, `@x402/fetch`, Pera Wallet, Algorand Testnet, GoPlausible, and USDC ASA `10458941`.

## Links

- Live product: https://agentpay-firewall.vercel.app/
- Dynamic x402 resource: `https://agentpay-firewall.vercel.app/api/x402/pay?request=<signed-token>`
- Verified Algorand settlement: https://lora.algokit.io/testnet/transaction/SEQAUK2K5SHHLUA35273OWDNCXXWVODYUUKPZUHQ6JZ2WPQEQWDQ
- GitHub: https://github.com/FeeeeelixWong/agentpay-firewall
- Demo video: https://agentpay-firewall.vercel.app/agentpay-firewall-demo.mp4
