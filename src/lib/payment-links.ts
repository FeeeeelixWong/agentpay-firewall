export type PaymentLinkInput = {
  amountUsd: string;
  payTo: string;
  title?: string;
  description?: string;
};

export type PaymentLinkRequest = {
  version: 1;
  id: string;
  amountUsd: string;
  payTo: string;
  title: string;
  description: string;
  network: "Algorand Testnet";
  asset: "USDC";
  assetId: "10458941";
  createdAt: string;
  expiresAt: string;
};

export type PaymentLinkResponse = {
  request: PaymentLinkRequest;
  token: string;
  paymentUrl: string;
  resourceUrl: string;
};

export type PaymentLinkError = {
  error: string;
  message: string;
};
