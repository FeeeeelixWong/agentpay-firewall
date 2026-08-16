import { seedFromMnemonic } from "@algorandfoundation/algokit-utils/algo25";
import { ed25519Generator } from "@algorandfoundation/algokit-utils/crypto";
import { toClientAvmSigner } from "@x402/avm";
import { ExactAvmScheme } from "@x402/avm/exact/client";
import { decodePaymentResponseHeader, wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { createFacilitatorSettlementResponse, type PaymentNetwork } from "../src/lib/protocol";
import { readAlgorandX402Config } from "../src/lib/x402-algorand";

const config = readAlgorandX402Config();

const privateKeyFromMnemonic = (mnemonic: string) => {
  const seed = seedFromMnemonic(mnemonic);
  const { ed25519SecretKey } = ed25519Generator(seed);
  return Buffer.from(ed25519SecretKey).toString("base64");
};

const privateKey = config.buyerPrivateKey ??
  (config.buyerMnemonic ? privateKeyFromMnemonic(config.buyerMnemonic) : undefined);

if (!privateKey) {
  throw new Error(
    "Set ALGORAND_BUYER_PRIVATE_KEY (Base64 64-byte key) or ALGORAND_BUYER_MNEMONIC locally.",
  );
}

const signer = toClientAvmSigner(privateKey);
const fetchWithPayment = wrapFetchWithPaymentFromConfig(fetch, {
  schemes: [
    {
      network: "algorand:*",
      client: new ExactAvmScheme(signer),
    },
  ],
});

const response = await fetchWithPayment(config.targetUrl, {
  method: "GET",
  headers: { Accept: "application/json" },
  signal: AbortSignal.timeout(60_000),
});

const bodyText = await response.text();
const paymentResponseHeader = response.headers.get("PAYMENT-RESPONSE");

if (!paymentResponseHeader) {
  throw new Error(
    `Expected PAYMENT-RESPONSE from Algorand x402 request, got ${response.status}: ${bodyText}`,
  );
}

const facilitatorReceipt = decodePaymentResponseHeader(paymentResponseHeader);
const normalizedReceipt = createFacilitatorSettlementResponse({
  paymentId: process.env.ALGORAND_X402_PAYMENT_ID ?? `algorand_${Date.now()}`,
  amountUsd: Number(process.env.ALGORAND_X402_AMOUNT_USD ?? "0.001"),
  network: facilitatorReceipt.network as PaymentNetwork,
  transaction: facilitatorReceipt.transaction,
  facilitatorUrl: config.facilitatorUrl,
  success: facilitatorReceipt.success,
});

console.log("Algorand x402 payment completed");
console.log(`Status: ${response.status}`);
console.log(`Target: ${config.targetUrl}`);
console.log(`Payer: ${facilitatorReceipt.payer ?? signer.address}`);
console.log(`Transaction: ${facilitatorReceipt.transaction}`);
console.log(`Network: ${facilitatorReceipt.network}`);
console.log(`Explorer: ${normalizedReceipt.explorerUrl ?? "unsupported network"}`);
console.log(`Response body: ${bodyText}`);
