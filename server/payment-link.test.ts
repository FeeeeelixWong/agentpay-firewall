import { describe, expect, it } from "vitest";
import {
  createPaymentLinkToken,
  normalizePaymentLinkInput,
  verifyPaymentLinkToken,
} from "./payment-link";

const secret = "test-secret-with-more-than-thirty-two-characters";
const payTo = "U3SN2UCQENDGE3CHKPBMXRSNJ2GFCCHLBT7NUC46VSPEGZDMOIQNCHPQJA";

describe("signed payment links", () => {
  it("round-trips a seller payment request", () => {
    const now = Date.parse("2026-08-18T00:00:00.000Z");
    const created = createPaymentLinkToken(
      { amountUsd: "1.250000", payTo, title: "Research report" },
      { secret, now },
    );
    const verified = verifyPaymentLinkToken(created.token, { secret, now: now + 1_000 });

    expect(verified.amountUsd).toBe("1.25");
    expect(verified.payTo).toBe(payTo);
    expect(verified.title).toBe("Research report");
  });

  it("rejects a tampered payment request", () => {
    const created = createPaymentLinkToken({ amountUsd: "0.001", payTo }, { secret });
    const [payload, signature] = created.token.split(".");
    const tampered = `${payload.slice(0, -1)}A.${signature}`;

    expect(() => verifyPaymentLinkToken(tampered, { secret })).toThrow("signature is invalid");
  });

  it("rejects an expired payment request", () => {
    const now = Date.parse("2026-08-18T00:00:00.000Z");
    const created = createPaymentLinkToken(
      { amountUsd: "0.001", payTo },
      { secret, now, ttlMs: 1_000 },
    );

    expect(() => verifyPaymentLinkToken(created.token, { secret, now: now + 1_001 })).toThrow(
      "expired",
    );
  });

  it("rejects invalid addresses and amounts", () => {
    expect(() => normalizePaymentLinkInput({ amountUsd: "0", payTo })).toThrow("greater than zero");
    expect(() => normalizePaymentLinkInput({ amountUsd: "0.001", payTo: "invalid" })).toThrow(
      "valid Algorand address",
    );
  });
});
