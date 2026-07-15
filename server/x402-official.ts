import express from "express";
import { HTTPFacilitatorClient, type RoutesConfig } from "@x402/core/server";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { scenarios } from "../src/lib/scenarios";
import { describeOfficialX402Readiness, readOfficialX402Config } from "../src/lib/x402-official";

const config = readOfficialX402Config();
const port = Number(process.env.X402_PORT ?? 8790);
const scenario = scenarios["allowed-risk-scan"];

if (!config.payTo) {
  console.error("X402_PAY_TO is required to run the official x402 resource server.");
  console.error("Run npm run x402:ready to see the full readiness checklist.");
  process.exit(1);
}

const app = express();

app.use((request, response, next) => {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Expose-Headers", "PAYMENT-REQUIRED, PAYMENT-RESPONSE");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, PAYMENT-SIGNATURE");
  response.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");

  if (request.method === "OPTIONS") {
    response.status(204).end();
    return;
  }

  next();
});

app.get("/api/health", (_request, response) => {
  response.json({
    ok: true,
    service: "agentpay-firewall-official-x402",
    mode: config.mode,
    network: config.network,
    facilitatorUrl: config.facilitatorUrl,
  });
});

const facilitatorClient = new HTTPFacilitatorClient({
  url: config.facilitatorUrl,
});

const resourceServer = new x402ResourceServer(facilitatorClient).register(
  config.network,
  new ExactEvmScheme(),
);

const routes: RoutesConfig = {
  "GET /api/paid/allowed-risk-scan": {
    accepts: {
      scheme: "exact",
      price: config.price,
      network: config.network,
      payTo: config.payTo,
    },
    description: scenario.requirement.description,
    mimeType: "application/json",
    serviceName: "AgentPay Firewall official x402 resource",
    unpaidResponseBody: () => ({
      contentType: "application/json",
      body: {
        error: "Payment required",
        message:
          "Official x402 middleware returned this 402 challenge. Retry with an x402 PAYMENT-SIGNATURE.",
        mode: config.mode,
        network: config.network,
        facilitatorUrl: config.facilitatorUrl,
      },
    }),
    settlementFailedResponseBody: (_context: unknown, settleResult: unknown) => ({
      contentType: "application/json",
      body: {
        error: "Settlement failed",
        settleResult,
      },
    }),
  },
};

app.use(paymentMiddleware(routes, resourceServer));

app.get("/api/paid/allowed-risk-scan", (_request, response) => {
  response.json({
    data: scenario.result,
    officialX402: {
      mode: config.mode,
      network: config.network,
      facilitatorUrl: config.facilitatorUrl,
      payTo: config.payTo,
      price: config.price,
    },
  });
});

app.listen(port, "127.0.0.1", () => {
  console.log(`Official x402 resource server listening on http://127.0.0.1:${port}`);
  console.log(
    describeOfficialX402Readiness(config)
      .map((item) => `${item.ready ? "OK" : "MISSING"} ${item.name}: ${item.detail}`)
      .join("\n"),
  );
});
