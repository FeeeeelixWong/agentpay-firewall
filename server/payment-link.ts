import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { isValidAlgorandAddress } from "@x402/avm";
import type { PaymentLinkInput, PaymentLinkRequest } from "../src/lib/payment-links";

const TOKEN_VERSION = 1;
const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1_000;
const MIN_SECRET_LENGTH = 32;
const MAX_AMOUNT_USD = 10_000;
const AMOUNT_PATTERN = /^(?:0|[1-9]\d{0,4})(?:\.\d{1,6})?$/;

type TokenOptions = {
  secret?: string;
  now?: number;
  ttlMs?: number;
};

const base64UrlEncode = (value: string | Buffer) => Buffer.from(value).toString("base64url");
const base64UrlDecode = (value: string) => Buffer.from(value, "base64url").toString("utf8");

const getSecret = (explicitSecret?: string) => {
  const secret = explicitSecret ?? process.env.PAYMENT_LINK_SECRET?.trim();

  if (!secret || secret.length < MIN_SECRET_LENGTH) {
    throw new Error("PAYMENT_LINK_SECRET must contain at least 32 characters.");
  }

  return secret;
};

const normalizeText = (value: unknown, fallback: string, maxLength: number) => {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized ? normalized.slice(0, maxLength) : fallback;
};

export const normalizePaymentLinkInput = (input: PaymentLinkInput) => {
  const amountUsd = String(input.amountUsd ?? "").trim();
  const payTo = String(input.payTo ?? "").trim();

  if (!AMOUNT_PATTERN.test(amountUsd)) {
    throw new Error("Amount must use up to 6 decimals and be greater than zero.");
  }

  const amountNumber = Number(amountUsd);
  if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
    throw new Error("Amount must be greater than zero.");
  }

  if (amountNumber > MAX_AMOUNT_USD) {
    throw new Error(`Amount must be between 0.000001 and ${MAX_AMOUNT_USD} USDC.`);
  }

  if (!isValidAlgorandAddress(payTo)) {
    throw new Error("Enter a valid Algorand address.");
  }

  const [whole, fraction] = amountUsd.split(".");
  const trimmedFraction = fraction?.replace(/0+$/, "") ?? "";

  return {
    amountUsd: trimmedFraction ? `${whole}.${trimmedFraction}` : whole,
    payTo,
    title: normalizeText(input.title, "Payment request", 60),
    description: normalizeText(input.description, "Payment requested through AgentPay Firewall.", 180),
  };
};

const signPayload = (payload: string, secret: string) =>
  createHmac("sha256", secret).update(payload).digest();

export const createPaymentLinkToken = (
  input: PaymentLinkInput,
  options: TokenOptions = {},
): { token: string; request: PaymentLinkRequest } => {
  const normalized = normalizePaymentLinkInput(input);
  const now = options.now ?? Date.now();
  const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
  const secret = getSecret(options.secret);
  const request: PaymentLinkRequest = {
    version: TOKEN_VERSION,
    id: randomUUID(),
    ...normalized,
    network: "Algorand Testnet",
    asset: "USDC",
    assetId: "10458941",
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + ttlMs).toISOString(),
  };
  const payload = base64UrlEncode(JSON.stringify(request));
  const signature = base64UrlEncode(signPayload(payload, secret));

  return {
    request,
    token: `${payload}.${signature}`,
  };
};

export const verifyPaymentLinkToken = (
  token: string,
  options: TokenOptions = {},
): PaymentLinkRequest => {
  const [payload, signature, extra] = token.split(".");

  if (!payload || !signature || extra) {
    throw new Error("Payment link is malformed.");
  }

  const secret = getSecret(options.secret);
  const expected = signPayload(payload, secret);
  let provided: Buffer;

  try {
    provided = Buffer.from(signature, "base64url");
  } catch {
    throw new Error("Payment link signature is malformed.");
  }

  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    throw new Error("Payment link signature is invalid.");
  }

  let request: PaymentLinkRequest;

  try {
    request = JSON.parse(base64UrlDecode(payload)) as PaymentLinkRequest;
  } catch {
    throw new Error("Payment link payload is invalid.");
  }

  if (request.version !== TOKEN_VERSION) {
    throw new Error("Payment link version is not supported.");
  }

  normalizePaymentLinkInput(request);

  const now = options.now ?? Date.now();
  const expiresAt = Date.parse(request.expiresAt);
  if (!Number.isFinite(expiresAt) || expiresAt <= now) {
    throw new Error("Payment link has expired.");
  }

  return request;
};
