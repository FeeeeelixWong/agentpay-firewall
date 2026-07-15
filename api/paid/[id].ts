import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  createSettlementResponse,
  decodeBase64Json,
  encodeBase64Json,
  verifyPaymentPayload,
  type PaymentPayload,
} from "../../src/lib/protocol";
import { getScenario } from "../../src/lib/scenarios";

const exposePaymentHeaders = (response: VercelResponse) => {
  response.setHeader("Access-Control-Expose-Headers", "PAYMENT-REQUIRED, PAYMENT-RESPONSE");
};

export default function handler(request: VercelRequest, response: VercelResponse) {
  exposePaymentHeaders(response);

  if (request.method !== "GET") {
    response.status(405).json({ error: "Method not allowed" });
    return;
  }

  const id = Array.isArray(request.query.id) ? request.query.id[0] : request.query.id;
  const scenario = id ? getScenario(id) : undefined;

  if (!scenario) {
    response.status(404).json({ error: "Not found" });
    return;
  }

  const paymentSignature = request.headers["payment-signature"];

  if (!paymentSignature || Array.isArray(paymentSignature)) {
    response.setHeader("PAYMENT-REQUIRED", encodeBase64Json(scenario.requirement));
    response.status(402).json({
      error: "Payment required",
      message:
        "The resource server returned an x402-style challenge. The agent wallet must decide whether it is allowed to sign.",
      requirement: scenario.requirement,
    });
    return;
  }

  try {
    const payload = decodeBase64Json<PaymentPayload>(paymentSignature);
    const valid = verifyPaymentPayload(scenario.requirement, payload);

    if (!valid) {
      response.status(402).json({
        error: "Invalid payment signature",
        message: "The payment payload did not match this resource, amount, network, or payment id.",
      });
      return;
    }

    const settlement = createSettlementResponse(scenario.requirement);
    response.setHeader("PAYMENT-RESPONSE", encodeBase64Json(settlement));
    response.status(200).json({
      data: scenario.result,
      receipt: settlement,
    });
  } catch (error) {
    response.status(400).json({
      error: "Malformed payment signature",
      message: error instanceof Error ? error.message : "Unknown decoding error",
    });
  }
}
