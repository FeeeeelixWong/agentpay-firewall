# AgentPay Firewall Demo Script

Production recording: about 100 seconds, with English voiceover in [demo-voiceover.txt](demo-voiceover.txt).
The MP4 includes burned-in captions that match the voiceover text. The `.srt` file is also generated for native YouTube captions.

Regenerate the video, WebM fallback, voiceover transcript, and subtitle file from the deployed product with:

```bash
npm run record:demo
```

Set `DEMO_APP_URL=http://127.0.0.1:5176` to record a local build instead. The script writes:

- `public/agentpay-firewall-demo.mp4`
- `public/agentpay-firewall-demo.webm`
- `public/agentpay-firewall-demo.srt`

## Storyboard

### 0:00 - 0:06 Hook

AgentPay Firewall turns autonomous agent payments into policy-controlled infrastructure.

### 0:06 - 0:18 Direct x402 Proof

The public Vercel endpoint runs x402 v2 directly on Algorand Testnet. One click verifies its HTTP 402 and decodes the `PAYMENT-REQUIRED` challenge.

### 0:18 - 0:29 Problem And Mandate

Agents can pay, but they still need rules. The user defines request caps, daily budget, approved services, network, asset, risk score, and human approval threshold.

### 0:29 - 0:39 Allowed x402 Flow

The agent calls a paid wallet-risk API. The seller returns an HTTP 402 challenge for exactly `0.001 USDC`.

### 0:39 - 0:49 Policy And Authorization

The product simulation shows that every policy gate passes before wallet authorization, followed by the retry and `PAYMENT-RESPONSE`.

### 0:49 - 0:59 Blocked Flow

A costly non-allowlisted crawl receives the same x402 challenge, but policy fails before signing. No payment authorization is created.

### 0:59 - 1:08 Manual Review

An allowed service crosses the approval threshold. The wallet pauses the payment instead of silently spending.

### 1:08 - 1:19 Real Wallet Path

The real path keeps the buyer key inside Pera Wallet. GoPlausible sponsors the group fee and settles the signed AVM payment.

### 1:19 - 1:32 Real Settlement Proof

The video shows the confirmed Algorand Testnet settlement:

- Settlement status: `confirmed`
- Amount: `0.001 USDC`
- Buyer: `25QHVX3LLUXIOHW7CRNRDDYMNZMVETYPGJIM66O2R2WZUMACHL2RDLRRBM`
- Seller: `U3SN2UCQENDGE3CHKPBMXRSNJ2GFCCHLBT7NUC46VSPEGZDMOIQNCHPQJA`
- Facilitator: `https://facilitator.goplausible.xyz`
- Transaction: `SEQAUK2K5SHHLUA35273OWDNCXXWVODYUUKPZUHQ6JZ2WPQEQWDQ`
- Confirmed round: `66373009`
- Explorer: `https://lora.algokit.io/testnet/transaction/SEQAUK2K5SHHLUA35273OWDNCXXWVODYUUKPZUHQ6JZ2WPQEQWDQ`

### 1:32 - 1:41 Close

AgentPay Firewall connects seller pricing, buyer-owned policy, wallet authorization, facilitator settlement, and an auditable onchain receipt.
