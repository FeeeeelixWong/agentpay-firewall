import { describe, expect, it } from "vitest";
import {
  ALGORAND_TESTNET_NETWORK,
  ALGORAND_TESTNET_USDC_ASA_ID,
  DEFAULT_ALGORAND_PAY_TO,
  GOPLAUSIBLE_FACILITATOR_URL,
  HOSTED_ALGORAND_X402_RESOURCE_URL,
  readAlgorandX402Config,
} from "./x402-algorand";

describe("Algorand x402 configuration", () => {
  it("uses the final-round network, asset, and facilitator", () => {
    const config = readAlgorandX402Config({});

    expect(config.network).toBe(ALGORAND_TESTNET_NETWORK);
    expect(ALGORAND_TESTNET_USDC_ASA_ID).toBe("10458941");
    expect(config.facilitatorUrl).toBe(GOPLAUSIBLE_FACILITATOR_URL);
    expect(config.price).toBe("$0.001");
    expect(config.payTo).toBe(DEFAULT_ALGORAND_PAY_TO);
  });

  it("publishes Algorand as the primary hosted endpoint", () => {
    expect(HOSTED_ALGORAND_X402_RESOURCE_URL).toMatch(/^https:\/\//);
    expect(HOSTED_ALGORAND_X402_RESOURCE_URL).toContain("/api/x402/official");
  });

  it("accepts seller, buyer, and endpoint overrides", () => {
    const config = readAlgorandX402Config({
      ALGORAND_PAY_TO: "SELLER",
      ALGORAND_BUYER_MNEMONIC: "buyer words",
      ALGORAND_X402_PRICE: "$0.01",
      ALGORAND_X402_TARGET_URL: "https://example.com/paid",
    });

    expect(config.payTo).toBe("SELLER");
    expect(config.buyerMnemonic).toBe("buyer words");
    expect(config.price).toBe("$0.01");
    expect(config.targetUrl).toBe("https://example.com/paid");
  });
});
