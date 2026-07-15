export type PaymentRequirement = {
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

export type PaymentPayload = {
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

export type SettlementResponse = {
  status: "settled" | "rejected";
  paymentId: string;
  settlementId: string;
  txHash: string;
  amountUsd: number;
  asset: "USDC";
  network: "eip155:8453";
  settledAt: string;
};

export type PaidApiResponse = {
  reportId: string;
  summary: string;
  labels: string[];
  confidence: number;
};

export const DEMO_AGENT_ADDRESS = "0xA9eF111a9eF111A9Ef111A9Ef111A9eF111a9EF1";
const DEMO_SIGNING_SEED = "agentpay-firewall-demo-signer";

const sortObject = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(sortObject);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, sortObject(item)]),
    );
  }

  return value;
};

export const stableStringify = (value: unknown) => JSON.stringify(sortObject(value));

export const sha256 = (value: string) => {
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

export const encodeBase64Json = (value: unknown) =>
  typeof Buffer === "undefined"
    ? window.btoa(unescape(encodeURIComponent(stableStringify(value))))
    : Buffer.from(stableStringify(value), "utf8").toString("base64");

export const decodeBase64Json = <T>(encoded: string): T =>
  JSON.parse(
    typeof Buffer === "undefined"
      ? decodeURIComponent(escape(window.atob(encoded)))
      : Buffer.from(encoded, "base64").toString("utf8"),
  ) as T;

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

export const createPaymentPayload = (
  requirement: PaymentRequirement,
  policyDecisionId: string,
): PaymentPayload => {
  const unsignedPayload: Omit<PaymentPayload, "signature"> = {
    requirementId: requirement.id,
    paymentId: requirement.paymentId,
    payer: DEMO_AGENT_ADDRESS,
    amountUsd: requirement.amountUsd,
    asset: requirement.asset,
    network: requirement.network,
    signedAt: new Date().toISOString(),
    policyDecisionId,
  };

  return {
    ...unsignedPayload,
    signature: `demo-eip712:${sha256(`${signatureBody(requirement, unsignedPayload)}:${DEMO_SIGNING_SEED}`)}`,
  };
};

export const verifyPaymentPayload = (
  requirement: PaymentRequirement,
  payload: PaymentPayload,
) => {
  if (payload.requirementId !== requirement.id) return false;
  if (payload.paymentId !== requirement.paymentId) return false;
  if (payload.amountUsd !== requirement.amountUsd) return false;
  if (payload.asset !== requirement.asset) return false;
  if (payload.network !== requirement.network) return false;

  const { signature, ...unsignedPayload } = payload;
  const expected = `demo-eip712:${sha256(`${signatureBody(requirement, unsignedPayload)}:${DEMO_SIGNING_SEED}`)}`;

  return signature === expected;
};

export const createSettlementResponse = (requirement: PaymentRequirement): SettlementResponse => {
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

export const shortHash = (value: string, start = 10, end = 6) =>
  value.length > start + end ? `${value.slice(0, start)}...${value.slice(-end)}` : value;
