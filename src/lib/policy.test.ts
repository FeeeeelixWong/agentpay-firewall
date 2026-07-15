import { describe, expect, it } from "vitest";
import { defaultPolicy, evaluatePayment } from "./policy";
import { scenarios } from "./scenarios";

describe("evaluatePayment", () => {
  it("approves a small allowlisted x402 request", () => {
    const decision = evaluatePayment(scenarios["allowed-risk-scan"].requirement, defaultPolicy);

    expect(decision.status).toBe("approved");
    expect(decision.checks.every((check) => check.status === "pass")).toBe(true);
  });

  it("blocks services outside the allowlist before signing", () => {
    const decision = evaluatePayment(scenarios["blocked-crawl"].requirement, defaultPolicy);

    expect(decision.status).toBe("blocked");
    expect(decision.reason).toMatch(/Service allowlist/);
  });

  it("routes allowed but higher value requests to manual review", () => {
    const decision = evaluatePayment(scenarios["manual-market-data"].requirement, defaultPolicy);

    expect(decision.status).toBe("manual_review");
  });
});
