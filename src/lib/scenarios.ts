import { sha256, type PaidApiResponse, type PaymentRequirement } from "./protocol";

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
    id: "blocked-crawl",
    label: "Blocked overspend",
    intent: "Agent tries to buy an expensive data crawl outside the allowlist.",
    resourcePath: "/api/paid/blocked-crawl",
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
    id: "manual-market-data",
    label: "Manual review",
    intent: "Agent finds a useful market-data endpoint, but the amount crosses the approval line.",
    resourcePath: "/api/paid/manual-market-data",
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
};

export const getScenario = (id: string) => scenarios[id as ScenarioId];
