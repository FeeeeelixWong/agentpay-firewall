# Brainwave 2026 Algorand x402 Final-Round Proof

## Project

**Name:** AgentPay Firewall

**Track:** Algorand x402 Blockchain Track

**Live product:** https://agentpay-firewall.vercel.app/

**Source:** https://github.com/FeeeeelixWong/agentpay-firewall

**Demo:** https://agentpay-firewall.vercel.app/agentpay-firewall-demo.mp4

## Product Correction Delivered

AgentPay Firewall is now a two-sided payment product instead of a fixed server demo:

1. The **Seller workspace** sets the payment title, exact USDC amount, receiving Algorand address, and description.
2. The server creates a **7-day HMAC-signed checkout link**. Changing the token invalidates the request.
3. The **Buyer checkout** displays the seller terms before Pera Wallet opens.
4. The checkout resolves to a dynamic x402 resource at `/api/x402/pay?request=<signed-token>`.
5. The resource returns HTTP `402` with an x402 v2 `PAYMENT-REQUIRED` challenge whose amount and recipient match the signed request.
6. Pera Wallet keeps buyer custody; GoPlausible verifies and settles the AVM payment.

## Fast Evaluator Flow

1. Open https://agentpay-firewall.vercel.app/.
2. Enter an amount and Algorand Testnet receiving address.
3. Click **Create payment link**.
4. Open the generated Buyer checkout.
5. Confirm the amount, recipient, network, and expiry are visible before wallet connection.
6. Use the repository smoke command below to verify the hosted `402`, AVM scheme, amount, recipient, ASA, and tamper rejection.

```bash
npm install
npm run smoke:checkout
```

The original canonical endpoint can also be verified with:

```bash
npm run smoke:x402
```

## Two Independent Evidence Layers

| Layer | What is proven |
| --- | --- |
| Product layer | Seller-created signed link, Buyer checkout, dynamic amount and recipient, expiry, and tamper rejection |
| Protocol layer | Live HTTP `402`, x402 v2 `exact` AVM challenge, Algorand Testnet, USDC ASA `10458941`, and GoPlausible facilitator |
| Settlement layer | A funded Pera Buyer completed an official GoPlausible x402 AVM payment on Algorand Testnet |

## Confirmed Official Settlement

- Transaction: [`SEQAUK2K5SHHLUA35273OWDNCXXWVODYUUKPZUHQ6JZ2WPQEQWDQ`](https://lora.algokit.io/testnet/transaction/SEQAUK2K5SHHLUA35273OWDNCXXWVODYUUKPZUHQ6JZ2WPQEQWDQ)
- Confirmed round: `66373009`
- Buyer: `25QHVX3LLUXIOHW7CRNRDDYMNZMVETYPGJIM66O2R2WZUMACHL2RDLRRBM`
- Seller: `U3SN2UCQENDGE3CHKPBMXRSNJ2GFCCHLBT7NUC46VSPEGZDMOIQNCHPQJA`
- Asset and amount: `1000` atomic units of USDC ASA `10458941` (`0.001 USDC`)
- Facilitator: GoPlausible
- Fee sponsorship: the facilitator supplied the atomic group fee while the Buyer transfer used a zero transaction fee

This receipt proves the official AVM settlement path for the same network, asset, amount, and recipient. The dynamic Seller-link path is separately proven by the hosted checkout smoke and mismatch assertions.

## Implementation Files

- Seller link API: [`api/payment-links.ts`](api/payment-links.ts)
- Dynamic x402 resource: [`api/x402/pay.ts`](api/x402/pay.ts)
- Signed-token implementation: [`server/payment-link.ts`](server/payment-link.ts)
- Seller and Buyer UI: [`src/App.tsx`](src/App.tsx)
- Pera integration: [`src/lib/algorand-wallet.ts`](src/lib/algorand-wallet.ts)
- Checkout smoke: [`scripts/payment-link-smoke.ts`](scripts/payment-link-smoke.ts)
- Canonical x402 smoke: [`scripts/x402-hosted-smoke.ts`](scripts/x402-hosted-smoke.ts)

## Accuracy Boundary

`/api/x402/pay` is the dynamic Seller-link product route. `/api/x402/official` remains the canonical fixed-price verification route used for the confirmed settlement. `/api/paid/*` is a deterministic policy simulator, and `/api/x402/base` is portability evidence only.
