# AgentPay Firewall Demo Script

Production recording: about 96 seconds, with English voiceover in [demo-voiceover.txt](demo-voiceover.txt).
The MP4 includes burned-in captions that match the voiceover text. The `.srt` file is also generated for native YouTube captions.

Regenerate the video, WebM fallback, voiceover transcript, and subtitle file with:

```bash
npm run record:demo
```

The recording starts the local Vite app and local `/api/paid/*` resource server when they are not already running, then writes:

- `public/agentpay-firewall-demo.mp4`
- `public/agentpay-firewall-demo.webm`
- `public/agentpay-firewall-demo.srt`

## Storyboard

### 0:00 - 0:06 Hook

AgentPay Firewall turns autonomous agent payments into policy-controlled infrastructure.

### 0:06 - 0:15 Problem

AI agents can call paid APIs, but they should not spend from a wallet without rules, budgets, and audit trails.

### 0:15 - 0:25 Policy Mandate

The user defines request caps, daily budget, approved services, network, asset, risk score, and human approval threshold.

### 0:25 - 0:44 Allowed x402 Flow

The agent calls a paid wallet-risk API. The server returns an HTTP 402 `PAYMENT-REQUIRED` challenge. The firewall checks policy, signs the request, retries the paid API, and receives `PAYMENT-RESPONSE`.

### 0:44 - 0:53 Blocked Flow

A costly non-allowlisted crawl receives the same x402 challenge, but policy fails before signing. No payment authorization is created.

### 0:53 - 1:02 Manual Review

An allowed service crosses the approval threshold. The wallet pauses the payment instead of silently spending.

### 1:02 - 1:14 Official OKX Path

The production-like path keeps the buyer key inside OKX Wallet and asks OKX to sign the x402 EIP-712 payload with `eth_signTypedData_v4`.

### 1:14 - 1:27 Real Settlement Proof

The video shows the reproduced Base Sepolia settlement:

- Official x402 receipt status: `settled`
- Amount: `0.001 USDC`
- Payer: `0x0934146ca4f8e611da0ef8bd295ee9f7e34741fe`
- PayTo: `0x4a6aae28b27681856ae824af82fea87896ecc3ed`
- Transaction: `0x322c19b1bc8e579e687e5cafdf7861ed5ebe47570b03a9ac0576dc128acdc6da`
- Explorer: `https://sepolia.basescan.org/tx/0x322c19b1bc8e579e687e5cafdf7861ed5ebe47570b03a9ac0576dc128acdc6da`

### 1:27 - 1:36 Close

AgentPay Firewall is the control layer that decides when autonomous payments are safe to execute.
