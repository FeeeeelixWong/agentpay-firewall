# AgentPay Firewall Architecture

AgentPay Firewall is a non-custodial checkout layer around x402. Sellers define payment terms, buyers retain wallet control, and the server prevents editable URLs from changing what the buyer is asked to sign.

## System Boundary

```mermaid
sequenceDiagram
  actor Seller
  participant Link as Payment Link API
  actor Buyer
  participant Resource as Dynamic x402 Resource
  participant Wallet as Pera Wallet
  participant Facilitator as GoPlausible
  participant Chain as Algorand Testnet

  Seller->>Link: amount + receiving address
  Link-->>Seller: HMAC-signed checkout URL
  Seller-->>Buyer: share checkout URL
  Buyer->>Link: verify signed request
  Link-->>Buyer: trusted amount + recipient
  Buyer->>Resource: GET signed request
  Resource-->>Buyer: 402 + PAYMENT-REQUIRED
  Buyer->>Buyer: compare challenge with signed terms
  Buyer->>Wallet: approve exact payment
  Wallet->>Resource: retry with PAYMENT-SIGNATURE
  Resource->>Facilitator: verify and settle
  Facilitator->>Chain: atomic USDC transaction group
  Resource-->>Buyer: protected result + PAYMENT-RESPONSE
```

## Seller Layer

The Seller UI submits payment terms to [`api/payment-links.ts`](api/payment-links.ts). [`server/payment-link.ts`](server/payment-link.ts) validates and normalizes the amount, Algorand address, title, and description. It creates a seven-day request and signs the serialized payload with HMAC-SHA256.

No database is required for the MVP. The request is self-contained, while authenticity comes from `PAYMENT_LINK_SECRET`. Changing one character in the payload or signature makes the link invalid.

## Buyer Layer

The Buyer route at `/pay?request=...` verifies the signed request through the server before displaying it. It shows the amount, asset, network, recipient, purpose, and expiry before wallet connection.

Before requesting a Pera signature, the client independently verifies:

1. The x402 challenge recipient equals the signed Seller recipient.
2. The x402 challenge atomic amount equals the signed Seller amount.
3. The payment uses the Algorand AVM x402 path and Testnet USDC.

The wallet private key and mnemonic never enter AgentPay Firewall.

## Dynamic x402 Resource

[`api/x402/pay.ts`](api/x402/pay.ts) uses a dynamic `price` and `payTo` supported by `@x402/core`. Both values are resolved only from the verified signed request.

```text
scheme: exact
network: algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=
asset: USDC ASA 10458941
price: signed Seller amount
payTo: signed Seller address
facilitator: https://facilitator.goplausible.xyz
```

The protected endpoint returns x402 v2 `PAYMENT-REQUIRED`, accepts a wallet-created `PAYMENT-SIGNATURE`, and exposes the facilitator `PAYMENT-RESPONSE` after settlement.

## Compatibility Route

The fixed-price endpoint `/api/x402/official` remains available as a stable proof artifact for the Algorand final. It is not used to create new seller-specific checkout links. The previous Base Sepolia implementation remains at `/api/x402/base` as portability evidence.

## Threat Controls

| Threat | Control |
| --- | --- |
| Buyer edits amount or recipient in URL | Terms are in a signed token, not trusted query fields |
| Modified token reaches facilitator | Token is verified before x402 middleware runs |
| Old link is replayed indefinitely | Signed requests expire after seven days |
| UI and x402 challenge disagree | Buyer compares amount and recipient before wallet approval |
| Server captures buyer key | Signing occurs only inside Pera Wallet |
| Fake settlement receipt | Receipt comes from x402 `PAYMENT-RESPONSE` and links to Lora |

## Production Extensions

A production release should add authenticated Seller organizations, revocable or single-use links, durable order state, webhook delivery, idempotency records, rate limits, custom expiry controls, and mainnet asset configuration. These are deliberately outside the stateless MVP trust boundary.
