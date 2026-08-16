import type { PaymentNetwork } from "./protocol";

export const ALGORAND_TESTNET_NETWORK =
  "algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=" as PaymentNetwork;
export const ALGORAND_TESTNET_USDC_ASA_ID = "10458941";
export const GOPLAUSIBLE_FACILITATOR_URL = "https://facilitator.goplausible.xyz";
export const DEFAULT_ALGORAND_PAY_TO =
  "U3SN2UCQENDGE3CHKPBMXRSNJ2GFCCHLBT7NUC46VSPEGZDMOIQNCHPQJA";
export const HOSTED_ALGORAND_X402_RESOURCE_URL =
  "https://agentpay-firewall.vercel.app/api/x402/official";
export const ALGORAND_TESTNET_LORA_URL = "https://lora.algokit.io/testnet";
export const VERIFIED_ALGORAND_SETTLEMENT_TX =
  "SEQAUK2K5SHHLUA35273OWDNCXXWVODYUUKPZUHQ6JZ2WPQEQWDQ";
export const VERIFIED_ALGORAND_SETTLEMENT_URL =
  `${ALGORAND_TESTNET_LORA_URL}/transaction/${VERIFIED_ALGORAND_SETTLEMENT_TX}`;

export type AlgorandX402Config = {
  network: PaymentNetwork;
  facilitatorUrl: string;
  price: string;
  payTo?: string;
  targetUrl: string;
  buyerPrivateKey?: string;
  buyerMnemonic?: string;
};

export const readAlgorandX402Config = (
  env: NodeJS.ProcessEnv = process.env,
): AlgorandX402Config => ({
  network: ALGORAND_TESTNET_NETWORK,
  facilitatorUrl: env.ALGORAND_X402_FACILITATOR_URL ?? GOPLAUSIBLE_FACILITATOR_URL,
  price: env.ALGORAND_X402_PRICE ?? "$0.001",
  payTo: env.ALGORAND_PAY_TO?.trim() || DEFAULT_ALGORAND_PAY_TO,
  targetUrl:
    env.ALGORAND_X402_TARGET_URL ??
    (env.VERCEL ? HOSTED_ALGORAND_X402_RESOURCE_URL : "http://127.0.0.1:8791/api/x402/official"),
  buyerPrivateKey: env.ALGORAND_BUYER_PRIVATE_KEY?.trim() || undefined,
  buyerMnemonic: env.ALGORAND_BUYER_MNEMONIC?.trim() || undefined,
});
