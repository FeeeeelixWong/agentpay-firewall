import type { ClientAvmSigner } from "@x402/avm";
import { ExactAvmScheme } from "@x402/avm/exact/client";
import { decodePaymentResponseHeader, wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import {
  createFacilitatorSettlementResponse,
  type PaidApiResponse,
  type PaymentNetwork,
  type SettlementResponse,
} from "./protocol";
import { GOPLAUSIBLE_FACILITATOR_URL } from "./x402-algorand";

export type AlgorandWalletPaymentResult = {
  address: string;
  paymentResponseHeader: string;
  settlement: SettlementResponse;
  apiResult: PaidApiResponse;
};

export const payOfficialX402WithAlgorandWallet = async ({
  targetUrl,
  address,
  signTransactions,
  amountUsd,
}: {
  targetUrl: string;
  address: string;
  signTransactions: ClientAvmSigner["signTransactions"];
  amountUsd: number;
}): Promise<AlgorandWalletPaymentResult> => {
  const signer: ClientAvmSigner = {
    address,
    signTransactions,
  };
  const fetchWithPayment = wrapFetchWithPaymentFromConfig(fetch, {
    schemes: [{ network: "algorand:*", client: new ExactAvmScheme(signer) }],
  });

  const response = await fetchWithPayment(targetUrl, {
    method: "GET",
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(60_000),
  });
  const bodyText = await response.text();
  const paymentResponseHeader = response.headers.get("PAYMENT-RESPONSE");

  if (!paymentResponseHeader) {
    throw new Error(
      `Expected PAYMENT-RESPONSE after Pera signing, received ${response.status}: ${bodyText}`,
    );
  }

  const facilitatorReceipt = decodePaymentResponseHeader(paymentResponseHeader);

  if (!facilitatorReceipt.success || !facilitatorReceipt.transaction) {
    throw new Error("GoPlausible returned a payment receipt without a successful transaction.");
  }

  let payload: { data?: PaidApiResponse };

  try {
    payload = JSON.parse(bodyText) as { data?: PaidApiResponse };
  } catch {
    throw new Error("The paid Algorand resource returned a non-JSON response.");
  }

  if (!payload.data) {
    throw new Error("The paid Algorand resource did not return the protected API result.");
  }

  return {
    address,
    paymentResponseHeader,
    settlement: createFacilitatorSettlementResponse({
      paymentId: `algorand_${Date.now()}`,
      amountUsd,
      network: facilitatorReceipt.network as PaymentNetwork,
      transaction: facilitatorReceipt.transaction,
      facilitatorUrl: GOPLAUSIBLE_FACILITATOR_URL,
      success: facilitatorReceipt.success,
    }),
    apiResult: payload.data,
  };
};
