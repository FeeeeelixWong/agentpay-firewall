import { HTTPFacilitatorClient } from "@x402/core/server";
import { ExactEvmScheme as ExactEvmClientScheme } from "@x402/evm/exact/client";
import { ExactEvmScheme as ExactEvmServerScheme } from "@x402/evm/exact/server";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { wrapFetchWithPaymentFromConfig, x402Client } from "@x402/fetch";
import { privateKeyToAccount } from "viem/accounts";
import { describeOfficialX402Readiness, readOfficialX402Config } from "../src/lib/x402-official";

const config = readOfficialX402Config();
const facilitatorClient = new HTTPFacilitatorClient({ url: config.facilitatorUrl });
const resourceServer = new x402ResourceServer(facilitatorClient).register(
  config.network,
  new ExactEvmServerScheme(),
);

const client = new x402Client();

if (config.privateKey) {
  const signer = privateKeyToAccount(config.privateKey);
  client.register("eip155:*", new ExactEvmClientScheme(signer));
  wrapFetchWithPaymentFromConfig(fetch, {
    schemes: [
      {
        network: "eip155:*",
        client: new ExactEvmClientScheme(signer),
      },
    ],
  });
}

console.log("Official x402 SDK readiness");
console.log(`Mode: ${config.mode}`);
console.log(`Network: ${config.network}`);
console.log(`Facilitator: ${config.facilitatorUrl}`);
console.log(`Server scheme registered: ${resourceServer.constructor.name}`);
console.log(`Express middleware loaded: ${paymentMiddleware.name || "paymentMiddleware"}`);
console.log(`Buyer client loaded: ${client.constructor.name}`);

for (const item of describeOfficialX402Readiness(config)) {
  console.log(`${item.ready ? "OK" : "MISSING"} ${item.name}: ${item.detail}`);
}

console.log(
  [
    "Readiness command passed.",
    "Use X402_PAY_TO npm run dev:x402 for the official seller path.",
    "Use X402_EVM_PRIVATE_KEY npm run x402:pay for a funded buyer payment.",
  ].join(" "),
);

