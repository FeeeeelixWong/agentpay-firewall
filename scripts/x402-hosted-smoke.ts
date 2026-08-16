import { decodePaymentRequiredHeader } from "@x402/core/http";
import { execFileSync } from "node:child_process";
import {
  ALGORAND_TESTNET_USDC_ASA_ID,
  HOSTED_ALGORAND_X402_RESOURCE_URL,
} from "../src/lib/x402-algorand";

const targetUrl = process.env.X402_HOSTED_URL ?? HOSTED_ALGORAND_X402_RESOURCE_URL;
const expectedNetworkPrefix = process.env.X402_EXPECTED_NETWORK_PREFIX ?? "algorand:";

type ChallengeResponse = {
  status: number;
  headers: { get(name: string): string | null };
};

const requestWithCurl = (): ChallengeResponse => {
  const output = execFileSync(
    "curl",
    ["-sS", "-L", "--max-time", "20", "-D", "-", "-o", "/dev/null", targetUrl],
    { encoding: "utf8" },
  );
  const blocks = output
    .split(/\r?\n\r?\n/)
    .map((block) => block.trim())
    .filter((block) => block.startsWith("HTTP/"));
  const lines = (blocks.at(-1) ?? "").split(/\r?\n/);
  const status = Number(lines[0]?.match(/^HTTP\/\S+\s+(\d+)/)?.[1] ?? 0);
  const headers = new Map<string, string>();

  for (const line of lines.slice(1)) {
    const separator = line.indexOf(":");
    if (separator === -1) continue;
    headers.set(line.slice(0, separator).trim().toLowerCase(), line.slice(separator + 1).trim());
  }

  return {
    status,
    headers: {
      get(name: string) {
        return headers.get(name.toLowerCase()) ?? null;
      },
    },
  };
};

const requestChallenge = async (): Promise<ChallengeResponse> => {
  try {
    return await fetch(targetUrl, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
    });
  } catch (error) {
    console.warn(
      `Fetch failed (${error instanceof Error ? error.message : "unknown error"}). Retrying with curl.`,
    );
    return requestWithCurl();
  }
};

const response = await requestChallenge();

if (response.status !== 402) {
  throw new Error(`Expected official HTTP 402 from ${targetUrl}, received ${response.status}.`);
}

const header = response.headers.get("PAYMENT-REQUIRED");

if (!header) {
  throw new Error("Official endpoint did not expose PAYMENT-REQUIRED.");
}

const challenge = decodePaymentRequiredHeader(header);
const accepted = challenge.accepts[0];

if (!accepted) {
  throw new Error("Official PAYMENT-REQUIRED did not include an accepted payment option.");
}

if (accepted.scheme !== "exact" || !accepted.network.startsWith(expectedNetworkPrefix)) {
  throw new Error(
    `Unexpected official payment option: ${accepted.scheme} on ${accepted.network}.`,
  );
}

if (
  expectedNetworkPrefix === "algorand:" &&
  accepted.extra?.asset !== ALGORAND_TESTNET_USDC_ASA_ID
) {
  throw new Error(
    `Expected Algorand Testnet USDC ASA ${ALGORAND_TESTNET_USDC_ASA_ID}, received ${String(accepted.extra?.asset)}.`,
  );
}

if (challenge.resource.url !== targetUrl) {
  throw new Error(
    `Challenge is bound to ${challenge.resource.url} instead of requested resource ${targetUrl}.`,
  );
}

console.log("Hosted official x402 challenge verified.");
console.log(`Resource: ${challenge.resource.url}`);
console.log(`Protocol version: ${challenge.x402Version}`);
console.log(`Scheme: ${accepted.scheme}`);
console.log(`Network: ${accepted.network}`);
console.log(`Amount: ${accepted.amount}`);
console.log(`Pay to: ${accepted.payTo}`);
