import { decodePaymentResponseHeader, wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";
import { createFacilitatorSettlementResponse, type PaymentNetwork } from "../src/lib/protocol";
import { readOfficialX402Config } from "../src/lib/x402-official";

const config = readOfficialX402Config();

if (!config.privateKey) {
  throw new Error("X402_EVM_PRIVATE_KEY or EVM_PRIVATE_KEY is required for npm run x402:pay.");
}

const signer = privateKeyToAccount(config.privateKey);
const fetchWithPayment = wrapFetchWithPaymentFromConfig(fetch, {
  schemes: [
    {
      network: "eip155:*",
      client: new ExactEvmScheme(signer),
    },
  ],
});

const response = await fetchWithPayment(config.targetUrl, {
  method: "GET",
  headers: {
    Accept: "application/json",
  },
  signal: AbortSignal.timeout(30_000),
});

const bodyText = await response.text();
const paymentResponseHeader = response.headers.get("PAYMENT-RESPONSE");

if (!paymentResponseHeader) {
  throw new Error(
    `Expected PAYMENT-RESPONSE from official x402 paid request, got ${response.status}: ${bodyText}`,
  );
}

const facilitatorReceipt = decodePaymentResponseHeader(paymentResponseHeader);
const normalizedReceipt = createFacilitatorSettlementResponse({
  paymentId: process.env.X402_PAYMENT_ID ?? `official_${Date.now()}`,
  amountUsd: Number(process.env.X402_AMOUNT_USD ?? "0.001"),
  network: facilitatorReceipt.network as PaymentNetwork,
  transaction: facilitatorReceipt.transaction,
  facilitatorUrl: config.facilitatorUrl,
  success: facilitatorReceipt.success,
});

console.log("Official x402 payment completed");
console.log(`Status: ${response.status}`);
console.log(`Target: ${config.targetUrl}`);
console.log(`Payer: ${facilitatorReceipt.payer ?? signer.address}`);
console.log(`Transaction: ${facilitatorReceipt.transaction}`);
console.log(`Network: ${facilitatorReceipt.network}`);
console.log(`Explorer: ${normalizedReceipt.explorerUrl ?? "unsupported network"}`);
console.log(`Response body: ${bodyText}`);

