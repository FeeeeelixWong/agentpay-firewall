import { USDC_TESTNET_ASA_ID } from "@x402/avm";
import { decodePaymentRequiredHeader } from "@x402/core/http";
import { readAlgorandX402Config } from "../src/lib/x402-algorand";

const config = readAlgorandX402Config();
const response = await fetch(config.targetUrl, {
  method: "GET",
  headers: { Accept: "application/json" },
  signal: AbortSignal.timeout(15_000),
});

if (response.status !== 402) {
  throw new Error(`Expected Algorand x402 402 challenge, got ${response.status}.`);
}

const paymentRequiredHeader = response.headers.get("PAYMENT-REQUIRED");

if (!paymentRequiredHeader) {
  throw new Error("Expected Algorand x402 PAYMENT-REQUIRED header.");
}

const paymentRequired = decodePaymentRequiredHeader(paymentRequiredHeader);
const [accepted] = paymentRequired.accepts;

if (!accepted) {
  throw new Error("Expected at least one accepted Algorand payment requirement.");
}

if (!accepted.network.startsWith("algorand:")) {
  throw new Error(`Expected Algorand network, received ${accepted.network}.`);
}

if (accepted.extra?.asset !== USDC_TESTNET_ASA_ID) {
  throw new Error(`Expected USDC Testnet ASA ${USDC_TESTNET_ASA_ID}.`);
}

console.log("Algorand x402 challenge passed");
console.log(`Resource: ${paymentRequired.resource.url}`);
console.log(`Scheme: ${accepted.scheme}`);
console.log(`Network: ${accepted.network}`);
console.log(`Amount: ${accepted.amount}`);
console.log(`Asset: ${accepted.extra.asset}`);
console.log(`Pay to: ${accepted.payTo}`);
