import { x402Client } from "@x402/core/client";
import {
  decodePaymentRequiredHeader,
  decodePaymentResponseHeader,
  encodePaymentSignatureHeader,
} from "@x402/core/http";
import type { PaymentRequired } from "@x402/core/types";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import {
  createFacilitatorSettlementResponse,
  sha256,
  type PaidApiResponse,
  type PaymentNetwork,
  type PaymentRequirement,
  type SettlementResponse,
} from "./protocol";
import { X402_TESTNET_FACILITATOR_URL } from "./x402-official";

export const DEFAULT_OKX_X402_TARGET_URL =
  (import.meta as ImportMeta & { env?: { VITE_X402_TARGET_URL?: string } }).env
    ?.VITE_X402_TARGET_URL ?? "http://127.0.0.1:8790/api/paid/allowed-risk-scan";

type Eip1193Provider = {
  request<T = unknown>(args: { method: string; params?: unknown[] | Record<string, unknown> }): Promise<T>;
};

type OkxWindow = Window & {
  okxwallet?: Eip1193Provider & {
    ethereum?: Eip1193Provider;
  };
  ethereum?:
    | (Eip1193Provider & {
        isOkxWallet?: boolean;
        providers?: Array<Eip1193Provider & { isOkxWallet?: boolean }>;
      })
    | undefined;
};

type TypedDataMessage = {
  domain: Record<string, unknown>;
  types: Record<string, unknown>;
  primaryType: string;
  message: Record<string, unknown>;
};

export type OfficialX402Challenge = {
  header: string;
  paymentRequired: PaymentRequired;
  requirement: PaymentRequirement;
};

export type OfficialOkxPaymentResult = {
  address: `0x${string}`;
  networkNotice?: string;
  paymentSignatureHeader: string;
  paymentResponseHeader: string;
  settlement: SettlementResponse;
  apiResult: PaidApiResponse;
};

type OkxChainConfig = {
  chainId: `0x${string}`;
  chainName: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  rpcUrls: string[];
  blockExplorerUrls: string[];
};

const OKX_SUPPORTED_EVM_CHAINS: Partial<Record<PaymentNetwork, OkxChainConfig>> = {
  "eip155:1": {
    chainId: "0x1",
    chainName: "Ethereum",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: ["https://ethereum-rpc.publicnode.com"],
    blockExplorerUrls: ["https://etherscan.io"],
  },
  "eip155:137": {
    chainId: "0x89",
    chainName: "Polygon",
    nativeCurrency: { name: "POL", symbol: "POL", decimals: 18 },
    rpcUrls: ["https://polygon-rpc.com"],
    blockExplorerUrls: ["https://polygonscan.com"],
  },
  "eip155:196": {
    chainId: "0xc4",
    chainName: "X Layer",
    nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 },
    rpcUrls: ["https://rpc.xlayer.tech"],
    blockExplorerUrls: ["https://www.oklink.com/xlayer"],
  },
  "eip155:8453": {
    chainId: "0x2105",
    chainName: "Base",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: ["https://mainnet.base.org"],
    blockExplorerUrls: ["https://basescan.org"],
  },
  "eip155:42161": {
    chainId: "0xa4b1",
    chainName: "Arbitrum One",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: ["https://arb1.arbitrum.io/rpc"],
    blockExplorerUrls: ["https://arbiscan.io"],
  },
};

const isLocalhostUrl = (url: URL) =>
  ["localhost", "127.0.0.1", "::1", "[::1]"].includes(url.hostname);

const localX402Help =
  "For the default local resource, run `X402_PAY_TO=0x4a6aae28b27681856ae824af82fea87896ecc3ed npm run dev:x402` and open the app from `http://127.0.0.1:5176` with `npm run dev:web`.";

const getOkxProvider = (): Eip1193Provider => {
  const candidateWindow = window as OkxWindow;
  const injectedOkxProvider = candidateWindow.ethereum?.providers?.find(
    (provider) => provider.isOkxWallet,
  );
  const provider =
    candidateWindow.okxwallet?.ethereum ??
    candidateWindow.okxwallet ??
    injectedOkxProvider ??
    (candidateWindow.ethereum?.isOkxWallet ? candidateWindow.ethereum : undefined);

  if (!provider?.request) {
    throw new Error("OKX Wallet extension was not detected in this browser.");
  }

  return provider;
};

const normalizeAddress = (value: unknown): `0x${string}` => {
  if (typeof value === "string" && value.startsWith("0x")) {
    return value as `0x${string}`;
  }

  throw new Error("OKX Wallet did not return an EVM address.");
};

const normalizeSignature = (value: unknown): `0x${string}` => {
  if (typeof value === "string" && value.startsWith("0x")) {
    return value as `0x${string}`;
  }

  throw new Error("OKX Wallet did not return a typed-data signature.");
};

const toJsonRpcValue = (value: unknown): unknown => {
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(toJsonRpcValue);

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        toJsonRpcValue(item),
      ]),
    );
  }

  return value;
};

const buildEip712DomainTypes = (domain: Record<string, unknown>) =>
  Object.keys(domain).map((name) => ({
    name,
    type:
      name === "chainId"
        ? "uint256"
        : name === "verifyingContract"
          ? "address"
          : name === "salt"
            ? "bytes32"
            : "string",
  }));

const switchOkxToNetwork = async (provider: Eip1193Provider, network: PaymentNetwork) => {
  const chain = OKX_SUPPORTED_EVM_CHAINS[network];

  if (!chain) {
    return {
      notice: `OKX Wallet may not list ${network}; continuing with typed-data signing because x402 EIP-3009 settlement is gasless and request-bound.`,
    };
  }

  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: chain.chainId }],
    });

    return {};
  } catch (error) {
    const code = typeof error === "object" && error ? (error as { code?: number }).code : undefined;

    if (code !== 4902) {
      throw error;
    }

    await provider.request({
      method: "wallet_addEthereumChain",
      params: [chain],
    });

    return {};
  }
};

export const connectOkxWallet = async (network: PaymentNetwork) => {
  const provider = getOkxProvider();
  const accounts = await provider.request<string[]>({ method: "eth_requestAccounts" });
  const address = normalizeAddress(accounts[0]);
  const { notice } = await switchOkxToNetwork(provider, network);

  return { provider, address, networkNotice: notice };
};

const createOkxX402Signer = (provider: Eip1193Provider, address: `0x${string}`) => ({
  address,
  async signTypedData(message: TypedDataMessage): Promise<`0x${string}`> {
    const typedData = {
      domain: toJsonRpcValue(message.domain),
      types: {
        EIP712Domain: buildEip712DomainTypes(message.domain),
        ...(toJsonRpcValue(message.types) as Record<string, unknown>),
      },
      primaryType: message.primaryType,
      message: toJsonRpcValue(message.message),
    };

    try {
      const signature = await provider.request<string>({
        method: "eth_signTypedData_v4",
        params: [address, JSON.stringify(typedData)],
      });

      return normalizeSignature(signature);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown wallet signing error";
      throw new Error(
        `OKX Wallet could not sign the x402 typed data. If this challenge uses a network the extension does not list, use an OKX-supported mainnet resource or the CLI Base Sepolia harness. Wallet error: ${message}`,
      );
    }
  },
});

const officialAmountToUsd = (amount: string) => Number(amount) / 1_000_000;

const normalizeOfficialChallenge = (
  header: string,
  paymentRequired: PaymentRequired,
): PaymentRequirement => {
  const accepted = paymentRequired.accepts[0];

  if (!accepted) {
    throw new Error("The official x402 challenge did not include a payable option.");
  }

  return {
    id: "official-okx-risk-scan",
    scheme: "exact",
    network: accepted.network as PaymentNetwork,
    asset: "USDC",
    amountUsd: officialAmountToUsd(accepted.amount),
    maxAmountRequired: accepted.amount,
    payTo: accepted.payTo,
    resource: paymentRequired.resource.url,
    serviceName: paymentRequired.resource.serviceName ?? "AgentPay Firewall official x402 resource",
    description: paymentRequired.resource.description ?? "Official x402 paid resource",
    expiresAt: new Date(Date.now() + accepted.maxTimeoutSeconds * 1_000).toISOString(),
    riskScore: 18,
    paymentId: `official_${sha256(header).slice(0, 16)}`,
  };
};

export const fetchOfficialX402Challenge = async (
  targetUrl: string,
): Promise<OfficialX402Challenge> => {
  let parsedTarget: URL;

  try {
    parsedTarget = new URL(targetUrl);
  } catch {
    throw new Error("Official resource URL is not a valid URL.");
  }

  if (
    window.location.protocol === "https:" &&
    parsedTarget.protocol === "http:" &&
    isLocalhostUrl(parsedTarget)
  ) {
    throw new Error(
      `The hosted HTTPS demo cannot call a local HTTP x402 server at ${targetUrl}. ${localX402Help}`,
    );
  }

  let response: Response;

  try {
    response = await fetch(targetUrl, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(15_000),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown network error";

    if (isLocalhostUrl(parsedTarget)) {
      throw new Error(
        `Could not reach the local official x402 resource at ${targetUrl}. ${localX402Help} Browser error: ${message}`,
      );
    }

    throw new Error(`Could not reach the official x402 resource at ${targetUrl}: ${message}`);
  }

  if (response.status !== 402) {
    throw new Error(`Expected official x402 402 challenge, got ${response.status}.`);
  }

  const header = response.headers.get("PAYMENT-REQUIRED");

  if (!header) {
    throw new Error("Expected official x402 PAYMENT-REQUIRED header.");
  }

  const paymentRequired = decodePaymentRequiredHeader(header);

  return {
    header,
    paymentRequired,
    requirement: normalizeOfficialChallenge(header, paymentRequired),
  };
};

export const payOfficialX402WithOkx = async ({
  targetUrl,
  challenge,
}: {
  targetUrl: string;
  challenge: OfficialX402Challenge;
}): Promise<OfficialOkxPaymentResult> => {
  const { provider, address, networkNotice } = await connectOkxWallet(challenge.requirement.network);
  const client = new x402Client().register("eip155:*", new ExactEvmScheme(createOkxX402Signer(provider, address)));
  const payload = await client.createPaymentPayload(challenge.paymentRequired);
  const paymentSignatureHeader = encodePaymentSignatureHeader(payload);
  const response = await fetch(targetUrl, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "PAYMENT-SIGNATURE": paymentSignatureHeader,
    },
    signal: AbortSignal.timeout(30_000),
  });
  const bodyText = await response.text();
  const paymentResponseHeader = response.headers.get("PAYMENT-RESPONSE");

  if (!response.ok || !paymentResponseHeader) {
    throw new Error(
      `Expected official x402 PAYMENT-RESPONSE, got ${response.status}: ${bodyText}`,
    );
  }

  const body = JSON.parse(bodyText) as { data?: PaidApiResponse };
  const facilitatorReceipt = decodePaymentResponseHeader(paymentResponseHeader);
  const settlement = createFacilitatorSettlementResponse({
    paymentId: challenge.requirement.paymentId,
    amountUsd: challenge.requirement.amountUsd,
    network: facilitatorReceipt.network as PaymentNetwork,
    transaction: facilitatorReceipt.transaction,
    facilitatorUrl: X402_TESTNET_FACILITATOR_URL,
    success: facilitatorReceipt.success,
  });

  return {
    address,
    networkNotice,
    paymentSignatureHeader,
    paymentResponseHeader,
    settlement,
    apiResult:
      body.data ?? {
        reportId: "official_okx_x402",
        summary: "Official x402 payment completed with OKX Wallet.",
        labels: ["official-x402", "okx-wallet", "base-sepolia"],
        confidence: 1,
      },
  };
};
