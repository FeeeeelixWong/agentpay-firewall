import { decodePaymentRequiredHeader } from "@x402/core/http";
import { readOfficialX402Config } from "../src/lib/x402-official";

const config = readOfficialX402Config();
const response = await fetch(config.targetUrl, {
  method: "GET",
  headers: {
    Accept: "application/json",
  },
  signal: AbortSignal.timeout(15_000),
});

if (response.status !== 402) {
  throw new Error(`Expected official x402 402 challenge, got ${response.status}.`);
}

const paymentRequiredHeader = response.headers.get("PAYMENT-REQUIRED");

if (!paymentRequiredHeader) {
  throw new Error("Expected official x402 PAYMENT-REQUIRED header.");
}

const paymentRequired = decodePaymentRequiredHeader(paymentRequiredHeader);
const [accepted] = paymentRequired.accepts;

if (!accepted) {
  throw new Error("Expected at least one accepted payment requirement.");
}

console.log("Official x402 challenge passed");
console.log(`Resource: ${paymentRequired.resource.url}`);
console.log(`Scheme: ${accepted.scheme}`);
console.log(`Network: ${accepted.network}`);
console.log(`Amount: ${accepted.amount}`);
console.log(`Asset: ${accepted.asset}`);
console.log(`Pay to: ${accepted.payTo}`);

