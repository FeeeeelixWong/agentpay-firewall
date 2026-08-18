import express from "express";
import type {
  PaymentLinkError,
  PaymentLinkInput,
  PaymentLinkResponse,
} from "../src/lib/payment-links.js";
import { createPaymentLinkToken, verifyPaymentLinkToken } from "../server/payment-link.js";

const route = "/api/payment-links";
const app = express();

app.disable("x-powered-by");
app.set("trust proxy", true);
app.use(express.json({ limit: "16kb" }));
app.use((_request, response, next) => {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Headers", "Accept, Content-Type");
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  response.setHeader("Cache-Control", "no-store");
  next();
});

app.options(route, (_request, response) => {
  response.status(204).end();
});

const publicOriginFor = (request: express.Request) => {
  const configured = process.env.PUBLIC_APP_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  if (process.env.VERCEL) return "https://agentpay-firewall.vercel.app";
  return `${request.protocol}://${request.get("host")}`;
};

const tokenFromRequest = (request: express.Request) => {
  const value = request.query.request;
  if (typeof value !== "string" || !value) {
    throw new Error("Payment request token is required.");
  }
  return value;
};

app.get(route, (request, response: express.Response<PaymentLinkResponse | PaymentLinkError>) => {
  try {
    const token = tokenFromRequest(request);
    const paymentRequest = verifyPaymentLinkToken(token);
    const origin = publicOriginFor(request);

    response.json({
      request: paymentRequest,
      token,
      paymentUrl: `${origin}/pay?request=${encodeURIComponent(token)}`,
      resourceUrl: `${origin}/api/x402/pay?request=${encodeURIComponent(token)}`,
    });
  } catch (error) {
    response.status(400).json({
      error: "Invalid payment link",
      message: error instanceof Error ? error.message : "Payment link validation failed.",
    });
  }
});

app.post(route, (request, response: express.Response<PaymentLinkResponse | PaymentLinkError>) => {
  try {
    const created = createPaymentLinkToken(request.body as PaymentLinkInput);
    const origin = publicOriginFor(request);

    response.status(201).json({
      request: created.request,
      token: created.token,
      paymentUrl: `${origin}/pay?request=${encodeURIComponent(created.token)}`,
      resourceUrl: `${origin}/api/x402/pay?request=${encodeURIComponent(created.token)}`,
    });
  } catch (error) {
    response.status(400).json({
      error: "Payment link could not be created",
      message: error instanceof Error ? error.message : "Payment link creation failed.",
    });
  }
});

export default app;
