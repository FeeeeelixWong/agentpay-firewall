# AgentPay Firewall - Brainwave 2026 Final-Round Correction

## Correction Implemented

AgentPay Firewall now directly implements x402 on Algorand Testnet. The protected endpoint is:

```text
https://agentpay-firewall.vercel.app/api/x402/official
```

An unpaid request returns HTTP `402` with an x402 v2 `PAYMENT-REQUIRED` challenge. The endpoint uses `@x402/express`, `@x402/core`, the `@x402/avm` exact scheme, Algorand Testnet USDC ASA `10458941`, and the GoPlausible facilitator.

The previous Base Sepolia path is retained only at `/api/x402/base` as portability evidence. It is no longer the primary final-round implementation.

## Evaluator Flow

1. Open https://agentpay-firewall.vercel.app/.
2. Click **Verify official 402**.
3. Confirm x402 v2, `exact`, Algorand Testnet, USDC ASA `10458941`, and the Seller address.
4. Connect Pera Wallet on Testnet.
5. Run the pre-sign policy check and click **Pay 0.001 USDC** for the funded path.
6. Inspect the returned Algorand transaction in Lora.
7. Run the allow, deny, and manual-review policy scenarios.

CLI verification:

```bash
npm install
npm run smoke:x402
```

## Direct Evidence

| Evidence | Value |
| --- | --- |
| Live resource | https://agentpay-firewall.vercel.app/api/x402/official |
| Protocol | x402 v2 |
| Scheme | exact |
| Network | Algorand Testnet |
| Asset | USDC ASA `10458941` |
| Price | `0.001 USDC` |
| Facilitator | GoPlausible |
| Seller | `U3SN2UCQENDGE3CHKPBMXRSNJ2GFCCHLBT7NUC46VSPEGZDMOIQNCHPQJA` |
| Seller middleware | `@x402/express`, `@x402/core`, `@x402/avm` |
| Browser signer | Pera Wallet |

## Readiness

- [x] Algorand is the primary hosted x402 route.
- [x] The endpoint returns a decodable Algorand `PAYMENT-REQUIRED` challenge.
- [x] GoPlausible supports the registered AVM scheme.
- [x] Pera Wallet buyer integration is implemented.
- [x] Automated tests and hosted smoke pass.
- [ ] Seller has Testnet ALGO and has opted into USDC ASA `10458941`.
- [ ] One final paid transaction is recorded and linked in Lora.

## Links

- Live app: https://agentpay-firewall.vercel.app/
- Source: https://github.com/FeeeeelixWong/agentpay-firewall
- Architecture: [ARCHITECTURE.md](ARCHITECTURE.md)
