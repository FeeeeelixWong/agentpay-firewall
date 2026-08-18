import { decodePaymentRequiredHeader } from "@x402/core/http";
import { execFileSync } from "node:child_process";
import { ALGORAND_TESTNET_USDC_ASA_ID, DEFAULT_ALGORAND_PAY_TO } from "../src/lib/x402-algorand";
import type { PaymentLinkError, PaymentLinkResponse } from "../src/lib/payment-links";

const origin = (process.env.PAYMENT_LINK_BASE_URL ?? "https://agentpay-firewall.vercel.app").replace(/\/$/, "");
const amountUsd = process.env.PAYMENT_LINK_SMOKE_AMOUNT ?? "0.001";

const curlJson = <T>(method: "GET" | "POST", url: string, body?: unknown) => {
  const args = ["-sS", "-L", "--max-time", "20", "-X", method, "-H", "Accept: application/json"];
  if (body !== undefined) {
    args.push("-H", "Content-Type: application/json", "--data", JSON.stringify(body));
  }
  args.push("-w", "\n__STATUS__:%{http_code}", url);
  const output = execFileSync("curl", args, { encoding: "utf8" });
  const marker = output.lastIndexOf("\n__STATUS__:");
  if (marker === -1) throw new Error(`Could not read HTTP status from ${url}.`);
  const status = Number(output.slice(marker + 12).trim());
  const responseBody = output.slice(0, marker);
  return { status, body: responseBody ? (JSON.parse(responseBody) as T) : undefined };
};

const curlHeaders = (url: string) => {
  const output = execFileSync(
    "curl",
    ["-sS", "-L", "--max-time", "20", "-D", "-", "-o", "/dev/null", "-H", "Accept: application/json", url],
    { encoding: "utf8" },
  );
  const blocks = output.split(/\r?\n\r?\n/).map((block) => block.trim()).filter((block) => block.startsWith("HTTP/"));
  const lines = (blocks.at(-1) ?? "").split(/\r?\n/);
  const status = Number(lines[0]?.match(/^HTTP\/\S+\s+(\d+)/)?.[1] ?? 0);
  const headers = new Map<string, string>();
  for (const line of lines.slice(1)) {
    const separator = line.indexOf(":");
    if (separator !== -1) headers.set(line.slice(0, separator).trim().toLowerCase(), line.slice(separator + 1).trim());
  }
  return { status, headers };
};

const createResponse = curlJson<PaymentLinkResponse>("POST", `${origin}/api/payment-links`, {
    amountUsd,
    payTo: DEFAULT_ALGORAND_PAY_TO,
    title: "Payment link smoke test",
    description: "Automated seller to buyer checkout verification.",
});

if (createResponse.status !== 201 || !createResponse.body) {
  throw new Error(`Payment link creation returned ${createResponse.status}.`);
}

const created = createResponse.body;
if (created.request.amountUsd !== amountUsd || created.request.payTo !== DEFAULT_ALGORAND_PAY_TO) {
  throw new Error("Created payment request does not match seller terms.");
}

const readResponse = curlJson<PaymentLinkResponse>("GET", `${origin}/api/payment-links?request=${encodeURIComponent(created.token)}`);
if (readResponse.status !== 200 || !readResponse.body) {
  throw new Error(`Buyer link validation returned ${readResponse.status}.`);
}

const loaded = readResponse.body;
if (loaded.request.id !== created.request.id || loaded.resourceUrl !== created.resourceUrl) {
  throw new Error("Buyer checkout did not resolve the seller-created payment request.");
}

const challengeResponse = curlHeaders(created.resourceUrl);
if (challengeResponse.status !== 402) {
  throw new Error(`Dynamic x402 resource returned ${challengeResponse.status} instead of 402.`);
}

const paymentRequired = challengeResponse.headers.get("payment-required");
if (!paymentRequired) throw new Error("Dynamic x402 resource did not expose PAYMENT-REQUIRED.");

const challenge = decodePaymentRequiredHeader(paymentRequired);
const accepted = challenge.accepts[0];
if (!accepted) throw new Error("Dynamic x402 challenge contains no accepted payment option.");

const expectedAtomicAmount = String(Math.round(Number(amountUsd) * 1_000_000));
if (accepted.amount !== expectedAtomicAmount) {
  throw new Error(`Expected ${expectedAtomicAmount} atomic USDC, received ${accepted.amount}.`);
}
if (accepted.payTo !== DEFAULT_ALGORAND_PAY_TO) {
  throw new Error(`Expected seller wallet ${DEFAULT_ALGORAND_PAY_TO}, received ${accepted.payTo}.`);
}
if (accepted.extra?.asset !== ALGORAND_TESTNET_USDC_ASA_ID) {
  throw new Error(`Expected USDC ASA ${ALGORAND_TESTNET_USDC_ASA_ID}, received ${String(accepted.extra?.asset)}.`);
}

const tamperedToken = `${created.token.slice(0, -1)}${created.token.endsWith("a") ? "b" : "a"}`;
const tamperedResponse = curlJson<PaymentLinkError>("GET", `${origin}/api/payment-links?request=${encodeURIComponent(tamperedToken)}`);
if (tamperedResponse.status !== 400) {
  throw new Error(`Tampered payment link returned ${tamperedResponse.status} instead of 400.`);
}

console.log("Seller-to-buyer payment link smoke passed.");
console.log(`Checkout: ${created.paymentUrl}`);
console.log(`Amount: ${amountUsd} USDC`);
console.log(`Pay to: ${DEFAULT_ALGORAND_PAY_TO}`);
console.log(`x402 challenge: ${challenge.x402Version} / ${accepted.scheme} / ${accepted.network}`);
console.log("Tamper protection: verified");
