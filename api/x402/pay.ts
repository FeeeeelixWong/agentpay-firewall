import {
  ALGORAND_TESTNET_CAIP2,
  USDC_TESTNET_ASA_ID,
} from "@x402/avm";
import { ExactAvmScheme } from "@x402/avm/exact/server";
import { HTTPFacilitatorClient, type HTTPRequestContext, type RoutesConfig } from "@x402/core/server";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import express from "express";
import { verifyPaymentLinkToken } from "../../server/payment-link.js";
import { GOPLAUSIBLE_FACILITATOR_URL } from "../../src/lib/x402-algorand.js";

const route = "/api/x402/pay";
const facilitatorClient = new HTTPFacilitatorClient({
  url: process.env.ALGORAND_X402_FACILITATOR_URL ?? GOPLAUSIBLE_FACILITATOR_URL,
});
const resourceServer = new x402ResourceServer(facilitatorClient).register(
  ALGORAND_TESTNET_CAIP2,
  new ExactAvmScheme(),
);

let initializationPromise: Promise<void> | null = null;
const initializeResourceServer = () => {
  if (initializationPromise) return initializationPromise;
  initializationPromise = resourceServer.initialize().catch((error) => {
    initializationPromise = null;
    throw error;
  });
  return initializationPromise;
};

const tokenFromContext = (context: HTTPRequestContext) => {
  const value = context.adapter.getQueryParam?.("request");
  if (typeof value !== "string" || !value) {
    throw new Error("Payment request token is required.");
  }
  return value;
};

const paymentRequestFromContext = (context: HTTPRequestContext) =>
  verifyPaymentLinkToken(tokenFromContext(context));

const routes: RoutesConfig = {
  [`GET ${route}`]: {
    accepts: {
      scheme: "exact",
      price: async (context) => `$${paymentRequestFromContext(context).amountUsd}`,
      network: ALGORAND_TESTNET_CAIP2,
      payTo: async (context) => paymentRequestFromContext(context).payTo,
      extra: { asset: USDC_TESTNET_ASA_ID },
    },
    description: "A seller-created payment request protected by AgentPay Firewall.",
    mimeType: "application/json",
    serviceName: "AgentPay Firewall checkout",
    unpaidResponseBody: (context) => {
      const paymentRequest = paymentRequestFromContext(context);
      return {
        contentType: "application/json",
        body: {
          error: "Payment required",
          paymentRequest,
          protocol: "x402",
          facilitator: "GoPlausible",
        },
      };
    },
    settlementFailedResponseBody: (_context, settleResult) => ({
      contentType: "application/json",
      body: {
        error: "Settlement failed",
        settleResult,
      },
    }),
  },
};

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", true);
app.use((_request, response, next) => {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Expose-Headers", "PAYMENT-REQUIRED, PAYMENT-RESPONSE");
  response.setHeader("Access-Control-Allow-Headers", "Accept, Content-Type, PAYMENT-SIGNATURE");
  response.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  response.setHeader("Cache-Control", "no-store");

  if (_request.method === "OPTIONS") {
    response.status(204).end();
    return;
  }
  next();
});

app.use(route, async (request, response, next) => {
  try {
    const token = typeof request.query.request === "string" ? request.query.request : "";
    verifyPaymentLinkToken(token);
    await initializeResourceServer();
    next();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Payment request validation failed.";
    const status = message.includes("expired") ? 410 : 400;
    response.status(status).json({
      error: status === 410 ? "Payment link expired" : "Invalid payment link",
      message,
    });
  }
});

app.use(paymentMiddleware(routes, resourceServer, undefined, undefined, false));

app.get(route, (request, response) => {
  const token = typeof request.query.request === "string" ? request.query.request : "";
  const paymentRequest = verifyPaymentLinkToken(token);

  response.json({
    data: {
      reportId: paymentRequest.id,
      summary: `${paymentRequest.title} was paid through AgentPay Firewall.`,
      labels: ["seller-payment", "x402-avm", "algorand-testnet"],
      confidence: 1,
    },
    paymentRequest,
    integration: {
      protocol: "x402",
      implementation: "@x402/express + @x402/avm",
      network: ALGORAND_TESTNET_CAIP2,
      asset: USDC_TESTNET_ASA_ID,
      facilitator: "GoPlausible",
      facilitatorUrl: process.env.ALGORAND_X402_FACILITATOR_URL ?? GOPLAUSIBLE_FACILITATOR_URL,
      payTo: paymentRequest.payTo,
      price: `$${paymentRequest.amountUsd}`,
    },
  });
});

export default app;
