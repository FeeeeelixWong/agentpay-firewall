# AgentPay Firewall Demo Script

Production recording: 53 seconds, with English voiceover in [demo-voiceover.txt](demo-voiceover.txt).

The longer outline below is kept as the source narrative for future extended demos.

## 0:00 - 0:15 Problem

AI agents are starting to call paid APIs and buy digital services. But giving an autonomous agent raw signing power is unsafe.

AgentPay Firewall is a policy wallet for x402 payments. It lets the agent pay only when the request fits the user's rules.

## 0:15 - 0:35 Policy Setup

Here is the wallet policy: max per request, daily budget, human approval threshold, and allowed services.

The key idea is simple: the agent can act, but only inside this mandate.

## 0:35 - 1:10 Allowed x402 Payment

First, the research agent needs one wallet-risk label before answering a user.

When I run the flow, the paid API returns an HTTP 402 challenge with `PAYMENT-REQUIRED`.

The wallet checks the service allowlist, amount cap, daily budget, USDC asset, Base network, and risk score.

Everything passes, so the wallet creates a `PAYMENT-SIGNATURE`, retries the request, and receives a `PAYMENT-RESPONSE` settlement receipt.

## 1:10 - 1:40 Blocked Payment

Now the same agent tries to buy a larger web crawl from a non-allowlisted service.

The wallet still receives the payment challenge, but policy fails before signing.

No `PAYMENT-SIGNATURE` is generated, the paid API does not receive authorization, and the audit log records the reason.

## 1:40 - 1:55 Why It Matters

Most agent payment demos prove that an agent can pay. AgentPay Firewall proves that an agent can be constrained.

That is the difference between a demo wallet and infrastructure people can trust.

## 1:55 - 2:05 Close

Next steps are official x402 facilitator integration, persistent replay protection, and onchain smart-account enforcement.
