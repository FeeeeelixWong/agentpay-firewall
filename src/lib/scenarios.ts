import { sha256, type PaidApiResponse, type PaymentRequirement } from "./protocol";

const ALGORAND_TESTNET = "algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=" as const;
const DEMO_SELLER = "U3SN2UCQENDGE3CHKPBMXRSNJ2GFCCHLBT7NUC46VSPEGZDMOIQNCHPQJA";

export type ScenarioId = "allowed-risk-scan" | "blocked-crawl" | "manual-market-data";

export type Scenario = {
  id: ScenarioId;
  label: string;
  intent: string;
  resourcePath: string;
  requirement: PaymentRequirement;
  result: PaidApiResponse;
};

const nowPlusMinutes = (minutes: number) => new Date(Date.now() + minutes * 60_000).toISOString();

const makeRequirement = (
  id: ScenarioId,
  overrides: Omit<PaymentRequirement, "id" | "scheme" | "maxAmountRequired" | "paymentId">,
): PaymentRequirement => ({
  id,
  scheme: "exact",
  maxAmountRequired: `${Math.round(overrides.amountUsd * 1_000_000)}`,
  paymentId: `pay_${sha256(`${id}:${overrides.resource}`).slice(0, 16)}`,
  ...overrides,
});

export const scenarios: Record<ScenarioId, Scenario> = {
  "allowed-risk-scan": {
    id: "allowed-risk-scan",
    label: "Allowed paid API",
    intent: "Research agent needs one wallet-risk label before answering a user.",
    resourcePath: "/api/paid/allowed-risk-scan",
    requirement: makeRequirement("allowed-risk-scan", {
      network: ALGORAND_TESTNET,
      asset: "USDC",
      amountUsd: 0.08,
      payTo: DEMO_SELLER,
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
    id: "blocked-crawl",
    label: "Blocked overspend",
    intent: "Agent tries to buy an expensive data crawl outside the allowlist.",
    resourcePath: "/api/paid/blocked-crawl",
    requirement: makeRequirement("blocked-crawl", {
      network: ALGORAND_TESTNET,
      asset: "USDC",
      amountUsd: 2.75,
      payTo: DEMO_SELLER,
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
    id: "manual-market-data",
    label: "Manual review",
    intent: "Agent finds a useful market-data endpoint, but the amount crosses the approval line.",
    resourcePath: "/api/paid/manual-market-data",
    requirement: makeRequirement("manual-market-data", {
      network: ALGORAND_TESTNET,
      asset: "USDC",
      amountUsd: 0.42,
      payTo: DEMO_SELLER,
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
};

export const getScenario = (id: string) => scenarios[id as ScenarioId];
