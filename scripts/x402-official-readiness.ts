import { ALGORAND_TESTNET_CAIP2, USDC_TESTNET_ASA_ID, isValidAlgorandAddress } from "@x402/avm";
import { ExactAvmScheme } from "@x402/avm/exact/server";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { readAlgorandX402Config } from "../src/lib/x402-algorand";

const config = readAlgorandX402Config();
const facilitatorClient = new HTTPFacilitatorClient({ url: config.facilitatorUrl });
const resourceServer = new x402ResourceServer(facilitatorClient).register(
  ALGORAND_TESTNET_CAIP2,
  new ExactAvmScheme(),
);

console.log("Algorand x402 final-round readiness");
console.log(`Network: ${config.network}`);
console.log(`USDC ASA: ${USDC_TESTNET_ASA_ID}`);
console.log(`Facilitator: ${config.facilitatorUrl}`);
console.log(`Server scheme registered: ${resourceServer.constructor.name}`);
console.log(`Express middleware loaded: ${paymentMiddleware.name || "paymentMiddleware"}`);
console.log(
  `${config.payTo && isValidAlgorandAddress(config.payTo) ? "OK" : "MISSING"} Seller address: ${config.payTo ?? "Set ALGORAND_PAY_TO"}`,
);
console.log(
  `${config.buyerPrivateKey || config.buyerMnemonic ? "OK" : "MISSING"} Buyer signer: ${config.buyerPrivateKey || config.buyerMnemonic ? "Configured locally" : "Set ALGORAND_BUYER_PRIVATE_KEY or ALGORAND_BUYER_MNEMONIC"}`,
);

await resourceServer.initialize();
console.log("OK GoPlausible facilitator supports the registered Algorand scheme.");
