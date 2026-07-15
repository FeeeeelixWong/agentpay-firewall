import { describe, expect, it } from "vitest";
import {
  buildExplorerUrl,
  createFacilitatorSettlementResponse,
  createPaymentPayload,
  createSettlementResponse,
  decodeBase64Json,
  encodeBase64Json,
  verifyPaymentPayload,
  type PaymentRequirement,
} from "./protocol";
import { scenarios } from "./scenarios";

describe("x402 protocol helpers", () => {
  it("encodes and decodes base64 JSON headers", () => {
    const requirement = scenarios["allowed-risk-scan"].requirement;
    const encoded = encodeBase64Json(requirement);

    expect(decodeBase64Json<PaymentRequirement>(encoded)).toEqual(requirement);
  });

  it("verifies an untampered payment payload", () => {
    const requirement = scenarios["allowed-risk-scan"].requirement;
    const payload = createPaymentPayload(requirement, "pol_demo");

    expect(verifyPaymentPayload(requirement, payload)).toBe(true);
  });

  it("rejects a payload transplanted to another paid resource", () => {
    const payload = createPaymentPayload(scenarios["allowed-risk-scan"].requirement, "pol_demo");

    expect(verifyPaymentPayload(scenarios["manual-market-data"].requirement, payload)).toBe(false);
  });

  it("marks generated judge receipts as demo evidence, not onchain settlement", () => {
    const settlement = createSettlementResponse(scenarios["allowed-risk-scan"].requirement);

    expect(settlement.receiptKind).toBe("demo-facilitator");
    expect(settlement.onchain).toBe(false);
    expect(settlement.explorerUrl).toBeUndefined();
  });

  it("builds explorer links for supported official receipt networks", () => {
    expect(buildExplorerUrl("eip155:8453", "0xabc")).toBe("https://basescan.org/tx/0xabc");
    expect(buildExplorerUrl("eip155:84532", "0xabc")).toBe(
      "https://sepolia.basescan.org/tx/0xabc",
    );
    expect(buildExplorerUrl("solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1", "sig")).toBe(
      "https://solscan.io/tx/sig?cluster=devnet",
    );
  });

  it("normalizes official facilitator receipts with explorer evidence", () => {
    const settlement = createFacilitatorSettlementResponse({
      paymentId: "pay_test",
      amountUsd: 0.01,
      network: "eip155:84532",
      transaction: "0xabc",
      facilitatorUrl: "https://x402.org/facilitator",
      success: true,
    });

    expect(settlement.receiptKind).toBe("x402-facilitator");
    expect(settlement.onchain).toBe(true);
    expect(settlement.explorerUrl).toBe("https://sepolia.basescan.org/tx/0xabc");
  });
});
