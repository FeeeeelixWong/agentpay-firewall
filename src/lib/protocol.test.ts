import { describe, expect, it } from "vitest";
import {
  createPaymentPayload,
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
});
