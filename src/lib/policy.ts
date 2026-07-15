import type { PaymentRequirement } from "./protocol";

export type AgentPolicy = {
  maxPerRequestUsd: number;
  dailyBudgetUsd: number;
  spentTodayUsd: number;
  allowedServices: string[];
  allowedAssets: string[];
  allowedNetworks: string[];
  manualApprovalAboveUsd: number;
  maxRiskScore: number;
};

export type PolicyDecision = {
  id: string;
  status: "approved" | "blocked" | "manual_review";
  reason: string;
  checks: Array<{
    label: string;
    status: "pass" | "fail" | "review";
    detail: string;
  }>;
};

const decisionId = (requirement: PaymentRequirement) =>
  `pol_${requirement.paymentId.replace(/[^a-zA-Z0-9]/g, "").slice(-10)}`;

export const defaultPolicy: AgentPolicy = {
  maxPerRequestUsd: 0.5,
  dailyBudgetUsd: 5,
  spentTodayUsd: 1.25,
  allowedServices: ["risklabel.ai", "chainwatch.dev", "oracle-kit.io"],
  allowedAssets: ["USDC"],
  allowedNetworks: ["eip155:8453"],
  manualApprovalAboveUsd: 0.35,
  maxRiskScore: 55,
};

export const evaluatePayment = (
  requirement: PaymentRequirement,
  policy: AgentPolicy,
): PolicyDecision => {
  const checks: PolicyDecision["checks"] = [
    {
      label: "Service allowlist",
      status: policy.allowedServices.includes(requirement.serviceName) ? "pass" : "fail",
      detail: requirement.serviceName,
    },
    {
      label: "Per-request cap",
      status: requirement.amountUsd <= policy.maxPerRequestUsd ? "pass" : "fail",
      detail: `$${requirement.amountUsd.toFixed(2)} <= $${policy.maxPerRequestUsd.toFixed(2)}`,
    },
    {
      label: "Daily budget",
      status:
        policy.spentTodayUsd + requirement.amountUsd <= policy.dailyBudgetUsd ? "pass" : "fail",
      detail: `$${(policy.spentTodayUsd + requirement.amountUsd).toFixed(2)} / $${policy.dailyBudgetUsd.toFixed(2)}`,
    },
    {
      label: "Asset",
      status: policy.allowedAssets.includes(requirement.asset) ? "pass" : "fail",
      detail: requirement.asset,
    },
    {
      label: "Network",
      status: policy.allowedNetworks.includes(requirement.network) ? "pass" : "fail",
      detail: requirement.network,
    },
    {
      label: "Risk score",
      status: requirement.riskScore <= policy.maxRiskScore ? "pass" : "fail",
      detail: `${requirement.riskScore} / ${policy.maxRiskScore}`,
    },
  ];

  const failedCheck = checks.find((check) => check.status === "fail");
  if (failedCheck) {
    return {
      id: decisionId(requirement),
      status: "blocked",
      reason: `${failedCheck.label} failed: ${failedCheck.detail}`,
      checks,
    };
  }

  if (requirement.amountUsd > policy.manualApprovalAboveUsd) {
    return {
      id: decisionId(requirement),
      status: "manual_review",
      reason: `Manual approval required above $${policy.manualApprovalAboveUsd.toFixed(2)}`,
      checks: checks.map((check) =>
        check.label === "Per-request cap" ? { ...check, status: "review" } : check,
      ),
    };
  }

  return {
    id: decisionId(requirement),
    status: "approved",
    reason: "All policy checks passed. Agent may sign this x402 payment.",
    checks,
  };
};
