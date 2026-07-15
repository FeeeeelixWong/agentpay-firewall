import type { PaymentNetwork } from "./protocol";

export const X402_TESTNET_FACILITATOR_URL = "https://x402.org/facilitator";
export const X402_CDP_FACILITATOR_URL = "https://api.cdp.coinbase.com/platform/v2/x402";

export type OfficialX402Mode = "testnet" | "mainnet";

export type OfficialX402Config = {
  mode: OfficialX402Mode;
  network: PaymentNetwork;
  facilitatorUrl: string;
  price: string;
  payTo?: `0x${string}`;
  privateKey?: `0x${string}`;
  targetUrl: string;
  cdpApiKeyId?: string;
  cdpApiKeySecret?: string;
};

const isOfficialX402Mode = (value: string | undefined): value is OfficialX402Mode =>
  value === "testnet" || value === "mainnet";

const asHex = (value: string | undefined) =>
  value?.startsWith("0x") ? (value as `0x${string}`) : undefined;

export const readOfficialX402Config = (
  env: NodeJS.ProcessEnv = process.env,
): OfficialX402Config => {
  const mode = isOfficialX402Mode(env.X402_MODE) ? env.X402_MODE : "testnet";
  const defaultNetwork: PaymentNetwork = mode === "mainnet" ? "eip155:8453" : "eip155:84532";
  const defaultFacilitator =
    mode === "mainnet" ? X402_CDP_FACILITATOR_URL : X402_TESTNET_FACILITATOR_URL;

  return {
    mode,
    network: (env.X402_NETWORK as PaymentNetwork | undefined) ?? defaultNetwork,
    facilitatorUrl: env.X402_FACILITATOR_URL ?? defaultFacilitator,
    price: env.X402_PRICE ?? "$0.001",
    payTo: asHex(env.X402_PAY_TO),
    privateKey: asHex(env.X402_EVM_PRIVATE_KEY ?? env.EVM_PRIVATE_KEY),
    targetUrl: env.X402_TARGET_URL ?? "http://127.0.0.1:8790/api/paid/allowed-risk-scan",
    cdpApiKeyId: env.CDP_API_KEY_ID,
    cdpApiKeySecret: env.CDP_API_KEY_SECRET,
  };
};

export const describeOfficialX402Readiness = (config: OfficialX402Config) => [
  {
    name: "Official x402 facilitator URL",
    ready: Boolean(config.facilitatorUrl),
    detail: config.facilitatorUrl,
  },
  {
    name: "Seller receiving wallet",
    ready: Boolean(config.payTo),
    detail: config.payTo ?? "Set X402_PAY_TO to run dev:x402.",
  },
  {
    name: "Buyer signing key",
    ready: Boolean(config.privateKey),
    detail: config.privateKey
      ? `${config.privateKey.slice(0, 6)}...${config.privateKey.slice(-4)}`
      : "Set X402_EVM_PRIVATE_KEY or EVM_PRIVATE_KEY to run x402:pay.",
  },
  {
    name: "Mainnet CDP facilitator auth",
    ready:
      config.mode !== "mainnet" || Boolean(config.cdpApiKeyId && config.cdpApiKeySecret),
    detail:
      config.mode === "mainnet"
        ? "Set CDP_API_KEY_ID and CDP_API_KEY_SECRET for CDP mainnet settlement."
        : "Not required for x402.org testnet facilitator.",
  },
];

