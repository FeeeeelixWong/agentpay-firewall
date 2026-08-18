# AgentPay Firewall Demo Script

Production recording: `81.33` seconds, with English voiceover in [demo-voiceover.txt](demo-voiceover.txt).

The MP4 includes burned-in captions generated from the same text and measured audio durations as the `.srt` file. This keeps voiceover and captions synchronized even when TTS duration changes.

Regenerate all assets from the deployed product with:

```bash
npm run record:demo
```

The script refuses to mix fallback voices. Set `DEMO_ALLOW_FALLBACK_VOICE=1` only when an offline macOS voice is explicitly acceptable.

Outputs:

- `public/agentpay-firewall-demo.mp4`
- `public/agentpay-firewall-demo.webm`
- `public/agentpay-firewall-demo.srt`
- `docs/demo-voiceover.txt`

## Storyboard

### 0:00.000 - 0:07.316 Product Hook

Position AgentPay Firewall as a payment product that both Sellers and Buyers can use.

### 0:07.316 - 0:17.316 Seller Creates The Request

Show the Seller naming the payment, setting `0.001 USDC`, selecting the Algorand receiving address, and adding context.

### 0:17.316 - 0:27.080 Signed Checkout Link

Create the link and show the Buyer amount, expiry, copy action, and tamper-protection statement.

### 0:27.080 - 0:36.124 Buyer Reviews The Terms

Open the separate Buyer checkout. Show title, amount, recipient, Algorand Testnet, and expiry before wallet connection.

### 0:36.124 - 0:46.680 Live Dynamic x402 Challenge

Show the deployed dynamic resource returning HTTP `402` with x402 v2 `PAYMENT-REQUIRED`, exact AVM, `0.001 USDC`, Algorand Testnet, ASA `10458941`, and the signed recipient.

### 0:46.680 - 0:56.732 Buyer Custody

Return to the Buyer checkout and show **Connect Pera Wallet**. Explain that AgentPay compares the live challenge with the Seller request before the Buyer gives final approval in Pera.

### 0:56.732 - 1:10.696 Official Settlement Evidence

Show the confirmed official AVM settlement path:

- Amount: `0.001 USDC`
- Buyer: `25QHVX3LLUXIOHW7CRNRDDYMNZMVETYPGJIM66O2R2WZUMACHL2RDLRRBM`
- Seller: `U3SN2UCQENDGE3CHKPBMXRSNJ2GFCCHLBT7NUC46VSPEGZDMOIQNCHPQJA`
- Facilitator: `https://facilitator.goplausible.xyz`
- Transaction: `SEQAUK2K5SHHLUA35273OWDNCXXWVODYUUKPZUHQ6JZ2WPQEQWDQ`
- Confirmed round: `66373009`
- Explorer: `https://lora.algokit.io/testnet/transaction/SEQAUK2K5SHHLUA35273OWDNCXXWVODYUUKPZUHQ6JZ2WPQEQWDQ`

This receipt proves live settlement for the same network, asset, amount, and Seller. It is not presented as a new transaction created during the recording.

### 1:10.696 - 1:21.324 Close

Close on the complete value proposition: Seller-created payment links, Buyer-owned authorization, official x402 settlement, and verifiable onchain receipts.
