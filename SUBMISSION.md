# AgentPay Firewall - Brainwave 2026 Final Resubmission

## Team Name

AgentPay Firewall

## Prototype Link

https://agentpay-firewall.vercel.app/

## GitHub Repository

https://github.com/FeeeeelixWong/agentpay-firewall

## Demo Video

https://agentpay-firewall.vercel.app/agentpay-firewall-demo.mp4

## Correction Implemented

AgentPay Firewall now directly integrates x402 on Algorand Testnet as a usable Seller-to-Buyer payment product. A Seller sets the amount and receiving Algorand address, then creates a 7-day HMAC-signed checkout link. The Buyer opens a separate checkout, reviews the exact terms, and connects Pera Wallet only after the signed request has been verified.

Each link resolves to a dynamic resource at:

```text
https://agentpay-firewall.vercel.app/api/x402/pay?request=<signed-token>
```

An unpaid request returns HTTP `402` with an x402 v2 `PAYMENT-REQUIRED` challenge. The resource uses `@x402/express`, `@x402/core`, the `@x402/avm` exact scheme, Algorand Testnet USDC ASA `10458941`, and the GoPlausible facilitator. The dynamic challenge must match the Seller-signed amount and recipient before the Buyer is asked to sign.

## Evaluator Flow

1. Open the live product.
2. Set a payment title, USDC amount, and Algorand Testnet receiving address.
3. Click **Create payment link**.
4. Open the generated Buyer checkout.
5. Confirm that the amount, recipient, network, and expiry match the Seller request.
6. Run `npm run smoke:checkout` to verify the live link creation, Buyer resolution, dynamic `402`, AVM details, and tamper rejection.
7. Inspect the verified official settlement in Lora.

## Direct Evidence

| Evidence | Value |
| --- | --- |
| Dynamic resource | `https://agentpay-firewall.vercel.app/api/x402/pay?request=<signed-token>` |
| Protocol | x402 v2 |
| Scheme | exact AVM |
| Network | Algorand Testnet |
| Asset | USDC ASA `10458941` |
| Example price | `0.001 USDC` |
| Facilitator | GoPlausible |
| Seller | `U3SN2UCQENDGE3CHKPBMXRSNJ2GFCCHLBT7NUC46VSPEGZDMOIQNCHPQJA` |
| Verified official settlement | [`SEQAUK2K5SHHLUA35273OWDNCXXWVODYUUKPZUHQ6JZ2WPQEQWDQ`](https://lora.algokit.io/testnet/transaction/SEQAUK2K5SHHLUA35273OWDNCXXWVODYUUKPZUHQ6JZ2WPQEQWDQ) |
| Confirmed round | `66373009` |
| Buyer signer | Pera Wallet |

## Readiness

- [x] Seller can set payment amount and recipient in the product UI.
- [x] Server creates an expiring HMAC-signed Buyer link.
- [x] Buyer sees exact terms before connecting a wallet.
- [x] Dynamic endpoint returns a decodable x402 v2 Algorand challenge.
- [x] Challenge amount and recipient are bound to the signed Seller request.
- [x] Tampered links are rejected.
- [x] GoPlausible supports the registered AVM scheme.
- [x] Pera Wallet Buyer integration is implemented.
- [x] Automated unit, build, hosted x402, and checkout smoke tests pass.
- [x] An official `0.001 USDC` AVM payment is confirmed on Algorand Testnet and linked in Lora.

## Submission Files

- PPTX: [`submission/AgentPay-Firewall-Brainwave-Resubmission.pptx`](submission/AgentPay-Firewall-Brainwave-Resubmission.pptx)
- PDF: [`submission/AgentPay-Firewall-Brainwave-Resubmission.pdf`](submission/AgentPay-Firewall-Brainwave-Resubmission.pdf)
- Architecture: [`ARCHITECTURE.md`](ARCHITECTURE.md)
