import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import {
  createSettlementResponse,
  decodeBase64Json,
  encodeBase64Json,
  verifyPaymentPayload,
  type PaymentPayload,
} from "../src/lib/protocol";
import { getScenario } from "../src/lib/scenarios";

const port = Number(process.env.PORT ?? 8787);
type NodeResponse = ServerResponse<IncomingMessage>;

const writeJson = (
  response: NodeResponse,
  statusCode: number,
  body: unknown,
  headers: Record<string, string> = {},
) => {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Expose-Headers": "PAYMENT-REQUIRED, PAYMENT-RESPONSE",
    ...headers,
  });
  response.end(JSON.stringify(body, null, 2));
};

const server = createServer((request, response) => {
  if (!request.url) {
    writeJson(response, 400, { error: "Missing URL" });
    return;
  }

  if (request.method === "OPTIONS") {
    response.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, PAYMENT-SIGNATURE",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
    });
    response.end();
    return;
  }

  const url = new URL(request.url, `http://${request.headers.host}`);

  if (request.method === "GET" && url.pathname === "/api/health") {
    writeJson(response, 200, { ok: true, service: "agentpay-firewall-api" });
    return;
  }

  const scenarioId = url.pathname.replace("/api/paid/", "");
  const scenario = getScenario(scenarioId);

  if (request.method !== "GET" || !scenario) {
    writeJson(response, 404, { error: "Not found" });
    return;
  }

  const paymentSignature = request.headers["payment-signature"];

  if (!paymentSignature || Array.isArray(paymentSignature)) {
    writeJson(
      response,
      402,
      {
        error: "Payment required",
        message:
          "The resource server returned an x402-style challenge. The agent wallet must decide whether it is allowed to sign.",
        requirement: scenario.requirement,
      },
      {
        "PAYMENT-REQUIRED": encodeBase64Json(scenario.requirement),
      },
    );
    return;
  }

  try {
    const payload = decodeBase64Json<PaymentPayload>(paymentSignature);
    const valid = verifyPaymentPayload(scenario.requirement, payload);

    if (!valid) {
      writeJson(response, 402, {
        error: "Invalid payment signature",
        message: "The payment payload did not match this resource, amount, network, or payment id.",
      });
      return;
    }

    const settlement = createSettlementResponse(scenario.requirement);
    writeJson(
      response,
      200,
      {
        data: scenario.result,
        receipt: settlement,
      },
      {
        "PAYMENT-RESPONSE": encodeBase64Json(settlement),
      },
    );
  } catch (error) {
    writeJson(response, 400, {
      error: "Malformed payment signature",
      message: error instanceof Error ? error.message : "Unknown decoding error",
    });
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`AgentPay Firewall API listening on http://127.0.0.1:${port}`);
});
