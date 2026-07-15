import {
  createPaymentPayload,
  decodeBase64Json,
  encodeBase64Json,
  type PaidApiResponse,
  type PaymentRequirement,
  type SettlementResponse,
} from "../src/lib/protocol";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const baseUrl = process.env.BASE_URL ?? "https://agentpay-firewall.vercel.app";
const paidPath = process.env.PAID_PATH ?? "/api/paid/allowed-risk-scan";
const url = new URL(paidPath, baseUrl);

type SmokeResponse = {
  status: number;
  ok: boolean;
  headers: {
    get(name: string): string | null;
  };
  json(): Promise<unknown>;
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

const parseCurlHeaders = (rawHeaders: string) => {
  const blocks = rawHeaders
    .split(/\r?\n\r?\n/)
    .map((block) => block.trim())
    .filter(Boolean);
  const finalBlock = blocks.at(-1) ?? "";
  const lines = finalBlock.split(/\r?\n/);
  const status = Number(lines[0]?.match(/^HTTP\/\S+\s+(\d+)/)?.[1] ?? 0);
  const headers = new Map<string, string>();

  for (const line of lines.slice(1)) {
    const separator = line.indexOf(":");
    if (separator === -1) continue;
    headers.set(line.slice(0, separator).trim().toLowerCase(), line.slice(separator + 1).trim());
  }

  return { status, headers };
};

const curlRequest = (input: URL, init: RequestInit = {}): SmokeResponse => {
  const dir = mkdtempSync(join(tmpdir(), "agentpay-smoke-"));
  const headerPath = join(dir, "headers.txt");
  const bodyPath = join(dir, "body.json");

  try {
    const args = ["-sS", "-L", "--max-time", "15", "-D", headerPath, "-o", bodyPath];
    const headers = new Headers(init.headers);

    for (const [key, value] of headers.entries()) {
      args.push("-H", `${key}: ${value}`);
    }

    args.push(input.toString());
    execFileSync("curl", args, { stdio: ["ignore", "pipe", "pipe"] });

    const { status, headers: responseHeaders } = parseCurlHeaders(readFileSync(headerPath, "utf8"));
    const body = readFileSync(bodyPath, "utf8");

    return {
      status,
      ok: status >= 200 && status < 300,
      headers: {
        get(name: string) {
          return responseHeaders.get(name.toLowerCase()) ?? null;
        },
      },
      async json() {
        return JSON.parse(body) as unknown;
      },
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

const request = async (input: URL, init: RequestInit = {}): Promise<SmokeResponse> => {
  try {
    return await fetch(input, {
      ...init,
      signal: AbortSignal.timeout(10_000),
    });
  } catch (error) {
    console.warn(
      `Fetch failed (${error instanceof Error ? error.message : "unknown error"}). Retrying with curl.`,
    );
    return curlRequest(input, init);
  }
};

const challengeResponse = await request(url);

assert(
  challengeResponse.status === 402,
  `Expected initial 402 challenge, got ${challengeResponse.status}`,
);

const paymentRequiredHeader = challengeResponse.headers.get("PAYMENT-REQUIRED");
assert(paymentRequiredHeader, "Expected PAYMENT-REQUIRED header on initial challenge");

const requirement = decodeBase64Json<PaymentRequirement>(paymentRequiredHeader);
const payload = createPaymentPayload(requirement, `smoke_${requirement.paymentId}`);
const paymentSignatureHeader = encodeBase64Json(payload);

const paidResponse = await request(url, {
  headers: {
    "PAYMENT-SIGNATURE": paymentSignatureHeader,
  },
});

assert(paidResponse.ok, `Expected paid retry to settle, got ${paidResponse.status}`);

const paymentResponseHeader = paidResponse.headers.get("PAYMENT-RESPONSE");
assert(paymentResponseHeader, "Expected PAYMENT-RESPONSE header after paid retry");

const body = (await paidResponse.json()) as {
  data?: PaidApiResponse;
  receipt?: SettlementResponse;
};
const settlement = decodeBase64Json<SettlementResponse>(paymentResponseHeader);

assert(body.data?.reportId, "Expected paid API data in settled response");
assert(body.receipt?.paymentId === requirement.paymentId, "Expected body receipt payment id to match");
assert(settlement.paymentId === requirement.paymentId, "Expected PAYMENT-RESPONSE payment id to match");
assert(settlement.status === "settled", "Expected settlement status to be settled");
assert(Boolean(settlement.txHash), "Expected settlement receipt to include txHash");

console.log(
  [
    "Smoke check passed:",
    `402 challenge -> PAYMENT-REQUIRED ${requirement.paymentId}`,
    "signed retry -> PAYMENT-RESPONSE",
    `receipt ${settlement.txHash}`,
  ].join(" "),
);
