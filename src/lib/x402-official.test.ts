import { describe, expect, it } from "vitest";
import {
  DEFAULT_X402_PAY_TO,
  HOSTED_X402_RESOURCE_URL,
  X402_TESTNET_FACILITATOR_URL,
  readOfficialX402Config,
} from "./x402-official";

describe("official x402 configuration", () => {
  it("is runnable with public Base Sepolia defaults", () => {
    const config = readOfficialX402Config({});

    expect(config.mode).toBe("testnet");
    expect(config.network).toBe("eip155:84532");
    expect(config.facilitatorUrl).toBe(X402_TESTNET_FACILITATOR_URL);
    expect(config.price).toBe("$0.001");
    expect(config.payTo).toBe(DEFAULT_X402_PAY_TO);
  });

  it("publishes an HTTPS judge-facing resource URL", () => {
    expect(HOSTED_X402_RESOURCE_URL).toMatch(/^https:\/\//);
    expect(HOSTED_X402_RESOURCE_URL).toContain("/api/x402/base");
  });

  it("accepts explicit production overrides", () => {
    const config = readOfficialX402Config({
      X402_MODE: "mainnet",
      X402_NETWORK: "eip155:8453",
      X402_FACILITATOR_URL: "https://facilitator.example",
      X402_PAY_TO: "0x1111111111111111111111111111111111111111",
      X402_PRICE: "$0.01",
    });

    expect(config.mode).toBe("mainnet");
    expect(config.network).toBe("eip155:8453");
    expect(config.facilitatorUrl).toBe("https://facilitator.example");
    expect(config.payTo).toBe("0x1111111111111111111111111111111111111111");
    expect(config.price).toBe("$0.01");
  });
});
