import type { VercelRequest, VercelResponse } from "@vercel/node";

type PaymentRequirement = {
  id: string;
  scheme: "exact";
  network: "eip155:8453";
  asset: "USDC";
  amountUsd: number;
  maxAmountRequired: string;
  payTo: string;
  resource: string;
  serviceName: string;
  description: string;
  expiresAt: string;
  riskScore: number;
  paymentId: string;
};

type PaymentPayload = {
  requirementId: string;
  paymentId: string;
  payer: string;
  amountUsd: number;
  asset: "USDC";
  network: "eip155:8453";
  signedAt: string;
  policyDecisionId: string;
  signature: string;
};

type SettlementResponse = {
  status: "settled" | "rejected";
  paymentId: string;
  settlementId: string;
  txHash: string;
  amountUsd: number;
  asset: "USDC";
  network: "eip155:8453";
  settledAt: string;
};

const demoAgentAddress = "0xA9eF111a9eF111A9Ef111A9Ef111A9eF111a9EF1";
const demoSigningSeed = "agentpay-firewall-demo-signer";

const sortObject = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(sortObject);

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, sortObject(item)]),
    );
  }

  return value;
};

const stableStringify = (value: unknown) => JSON.stringify(sortObject(value));

const sha256 = (value: string) => {
  let hashA = 0x811c9dc5;
  let hashB = 0x01000193;

  for (let index = 0; index < value.length; index += 1) {
    hashA ^= value.charCodeAt(index);
    hashA = Math.imul(hashA, 0x01000193);
    hashB ^= value.charCodeAt(value.length - index - 1);
    hashB = Math.imul(hashB, 0x811c9dc5);
  }

  const seed = `${(hashA >>> 0).toString(16).padStart(8, "0")}${(hashB >>> 0)
    .toString(16)
    .padStart(8, "0")}`;

  return Array.from({ length: 4 }, (_, index) =>
    ((
      Number.parseInt(seed.slice((index % 2) * 8, (index % 2) * 8 + 8), 16) ^
      Math.imul(index + 1, 0x9e3779b1)
    ) >>> 0)
      .toString(16)
      .padStart(8, "0"),
  ).join("");
};

const encodeBase64Json = (value: unknown) =>
  Buffer.from(stableStringify(value), "utf8").toString("base64");

const decodeBase64Json = <T,>(encoded: string): T =>
  JSON.parse(Buffer.from(encoded, "base64").toString("utf8")) as T;

const signatureBody = (
  requirement: PaymentRequirement,
  payload: Omit<PaymentPayload, "signature">,
) =>
  stableStringify({
    amountUsd: payload.amountUsd,
    asset: payload.asset,
    network: payload.network,
    payer: payload.payer,
    paymentId: payload.paymentId,
    policyDecisionId: payload.policyDecisionId,
    requirementId: payload.requirementId,
    signedAt: payload.signedAt,
    resource: requirement.resource,
    serviceName: requirement.serviceName,
  });

const verifyPaymentPayload = (requirement: PaymentRequirement, payload: PaymentPayload) => {
  if (payload.requirementId !== requirement.id) return false;
  if (payload.paymentId !== requirement.paymentId) return false;
  if (payload.amountUsd !== requirement.amountUsd) return false;
  if (payload.asset !== requirement.asset) return false;
  if (payload.network !== requirement.network) return false;
  if (payload.payer !== demoAgentAddress) return false;

  const { signature, ...unsignedPayload } = payload;
  const expected = `demo-eip712:${sha256(`${signatureBody(requirement, unsignedPayload)}:${demoSigningSeed}`)}`;

  return signature === expected;
};

const createSettlementResponse = (requirement: PaymentRequirement): SettlementResponse => {
  const digest = sha256(`${requirement.paymentId}:${requirement.amountUsd}:${Date.now()}`);

  return {
    status: "settled",
    paymentId: requirement.paymentId,
    settlementId: `set_${digest.slice(0, 18)}`,
    txHash: `0x${digest}${digest.slice(0, 24)}`,
    amountUsd: requirement.amountUsd,
    asset: requirement.asset,
    network: requirement.network,
    settledAt: new Date().toISOString(),
  };
};

const nowPlusMinutes = (minutes: number) => new Date(Date.now() + minutes * 60_000).toISOString();

const makeRequirement = (
  id: string,
  overrides: Omit<PaymentRequirement, "id" | "scheme" | "maxAmountRequired" | "paymentId">,
): PaymentRequirement => ({
  id,
  scheme: "exact",
  maxAmountRequired: `${Math.round(overrides.amountUsd * 1_000_000)}`,
  paymentId: `pay_${sha256(`${id}:${overrides.resource}`).slice(0, 16)}`,
  ...overrides,
});

const scenarios = {
  "allowed-risk-scan": {
    requirement: makeRequirement("allowed-risk-scan", {
      network: "eip155:8453",
      asset: "USDC",
      amountUsd: 0.08,
      payTo: "0xF1reWa11000000000000000000000000000000402",
      resource: "https://risklabel.ai/api/wallet-score?address=demo",
      serviceName: "risklabel.ai",
      description: "Wallet risk score API call",
      expiresAt: nowPlusMinutes(10),
      riskScore: 18,
    }),
    result: {
      reportId: "risk_402_demo_01",
      summary: "Wallet has normal transfer patterns and no known sanctions exposure.",
      labels: ["low-risk", "exchange-adjacent", "normal-volume"],
      confidence: 0.91,
    },
  },
  "blocked-crawl": {
    requirement: makeRequirement("blocked-crawl", {
      network: "eip155:8453",
      asset: "USDC",
      amountUsd: 2.75,
      payTo: "0xC0st1y0000000000000000000000000000000402",
      resource: "https://premium-crawl.example/api/large-crawl",
      serviceName: "premium-crawl.example",
      description: "Large web crawl package requested by autonomous agent",
      expiresAt: nowPlusMinutes(10),
      riskScore: 64,
    }),
    result: {
      reportId: "crawl_not_reached",
      summary: "This should never be served because policy blocks before signing.",
      labels: ["blocked"],
      confidence: 0,
    },
  },
  "manual-market-data": {
    requirement: makeRequirement("manual-market-data", {
      network: "eip155:8453",
      asset: "USDC",
      amountUsd: 0.42,
      payTo: "0xDa7a000000000000000000000000000000000402",
      resource: "https://chainwatch.dev/api/liquidity-snapshot",
      serviceName: "chainwatch.dev",
      description: "One-time DEX liquidity snapshot for research agent",
      expiresAt: nowPlusMinutes(10),
      riskScore: 31,
    }),
    result: {
      reportId: "liq_402_demo_07",
      summary: "Liquidity is concentrated in two pools; route depth is moderate.",
      labels: ["market-data", "dex-liquidity", "needs-human-approval"],
      confidence: 0.86,
    },
  },
} satisfies Record<string, { requirement: PaymentRequirement; result: unknown }>;

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
  const scenario =
    id && Object.prototype.hasOwnProperty.call(scenarios, id)
      ? scenarios[id as keyof typeof scenarios]
      : undefined;

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
