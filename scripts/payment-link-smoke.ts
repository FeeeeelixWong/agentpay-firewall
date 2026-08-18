import { decodePaymentRequiredHeader } from "@x402/core/http";
import { ALGORAND_TESTNET_USDC_ASA_ID, DEFAULT_ALGORAND_PAY_TO } from "../src/lib/x402-algorand";
import type { PaymentLinkResponse } from "../src/lib/payment-links";

const origin = (process.env.PAYMENT_LINK_BASE_URL ?? "https://agentpay-firewall.vercel.app").replace(/\/$/, "");
const amountUsd = process.env.PAYMENT_LINK_SMOKE_AMOUNT ?? "0.001";

const createResponse = await fetch(`${origin}/api/payment-links`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    amountUsd,
    payTo: DEFAULT_ALGORAND_PAY_TO,
    title: "Payment link smoke test",
    description: "Automated seller to buyer checkout verification.",
  }),
});

if (createResponse.status !== 201) {
  throw new Error(`Payment link creation returned ${createResponse.status}: ${await createResponse.text()}`);
}

const created = (await createResponse.json()) as PaymentLinkResponse;
if (created.request.amountUsd !== amountUsd || created.request.payTo !== DEFAULT_ALGORAND_PAY_TO) {
  throw new Error("Created payment request does not match seller terms.");
}

const readResponse = await fetch(`${origin}/api/payment-links?request=${encodeURIComponent(created.token)}`);
if (!readResponse.ok) {
  throw new Error(`Buyer link validation returned ${readResponse.status}: ${await readResponse.text()}`);
}

const loaded = (await readResponse.json()) as PaymentLinkResponse;
if (loaded.request.id !== created.request.id || loaded.resourceUrl !== created.resourceUrl) {
  throw new Error("Buyer checkout did not resolve the seller-created payment request.");
}

const challengeResponse = await fetch(created.resourceUrl, {
  headers: { Accept: "application/json" },
});
if (challengeResponse.status !== 402) {
  throw new Error(`Dynamic x402 resource returned ${challengeResponse.status} instead of 402.`);
}

const paymentRequired = challengeResponse.headers.get("PAYMENT-REQUIRED");
if (!paymentRequired) throw new Error("Dynamic x402 resource did not expose PAYMENT-REQUIRED.");

const challenge = decodePaymentRequiredHeader(paymentRequired);
const accepted = challenge.accepts[0];
if (!accepted) throw new Error("Dynamic x402 challenge contains no accepted payment option.");

const expectedAtomicAmount = String(Math.round(Number(amountUsd) * 1_000_000));
if (accepted.amount !== expectedAtomicAmount) {
  throw new Error(`Expected ${expectedAtomicAmount} atomic USDC, received ${accepted.amount}.`);
}
if (accepted.payTo !== DEFAULT_ALGORAND_PAY_TO) {
  throw new Error(`Expected seller wallet ${DEFAULT_ALGORAND_PAY_TO}, received ${accepted.payTo}.`);
}
if (accepted.extra?.asset !== ALGORAND_TESTNET_USDC_ASA_ID) {
  throw new Error(`Expected USDC ASA ${ALGORAND_TESTNET_USDC_ASA_ID}, received ${String(accepted.extra?.asset)}.`);
}

const tamperedToken = `${created.token.slice(0, -1)}${created.token.endsWith("a") ? "b" : "a"}`;
const tamperedResponse = await fetch(`${origin}/api/payment-links?request=${encodeURIComponent(tamperedToken)}`);
if (tamperedResponse.status !== 400) {
  throw new Error(`Tampered payment link returned ${tamperedResponse.status} instead of 400.`);
}

console.log("Seller-to-buyer payment link smoke passed.");
console.log(`Checkout: ${created.paymentUrl}`);
console.log(`Amount: ${amountUsd} USDC`);
console.log(`Pay to: ${DEFAULT_ALGORAND_PAY_TO}`);
console.log(`x402 challenge: ${challenge.x402Version} / ${accepted.scheme} / ${accepted.network}`);
console.log("Tamper protection: verified");
