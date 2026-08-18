import { useWallet } from "@txnlab/use-wallet-react";
import { isValidAddress } from "algosdk";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  FileLock2,
  Link2,
  LoaderCircle,
  LockKeyhole,
  ReceiptText,
  RefreshCcw,
  Send,
  ShieldCheck,
  Store,
  WalletCards,
} from "lucide-react";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import type {
  PaymentLinkError,
  PaymentLinkInput,
  PaymentLinkResponse,
} from "./lib/payment-links";
import { shortHash } from "./lib/protocol";
import {
  ALGORAND_TESTNET_LORA_URL,
  DEFAULT_ALGORAND_PAY_TO,
  GOPLAUSIBLE_FACILITATOR_URL,
} from "./lib/x402-algorand";

const formatUsd = (amount: string | number) => {
  const value = Number(amount);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: value > 0 && value < 0.01 ? 3 : 2,
    maximumFractionDigits: 6,
  }).format(value);
};

const messageFromResponse = async (response: Response) => {
  try {
    const body = (await response.json()) as Partial<PaymentLinkError>;
    return body.message || body.error || `Request failed with ${response.status}.`;
  } catch {
    return `Request failed with ${response.status}.`;
  }
};

const copyText = async (value: string) => navigator.clipboard.writeText(value);

function BrandHeader({ buyer = false }: { buyer?: boolean }) {
  return (
    <header className="site-header">
      <a className="brand" href="/" aria-label="AgentPay Firewall home">
        <span className="brand-mark" aria-hidden="true"><ShieldCheck /></span>
        <span><strong>AgentPay</strong><small>Firewall</small></span>
      </a>
      <nav className="site-nav" aria-label="Primary navigation">
        <a className={!buyer ? "active" : undefined} href="/"><Store />Seller</a>
        <a className={buyer ? "active" : undefined} href="/pay"><WalletCards />Buyer</a>
      </nav>
    </header>
  );
}

function ProductFooter() {
  return (
    <footer className="site-footer">
      <span>AgentPay Firewall</span>
      <span>Algorand Testnet · USDC · x402</span>
      <a href="https://github.com/FeeeeelixWong/agentpay-firewall" target="_blank" rel="noreferrer">
        Source <ExternalLink />
      </a>
    </footer>
  );
}

function SellerPage() {
  const [form, setForm] = useState<PaymentLinkInput>({
    amountUsd: "0.001",
    payTo: DEFAULT_ALGORAND_PAY_TO,
    title: "Agent service payment",
    description: "Payment for the completed agent task.",
  });
  const [result, setResult] = useState<PaymentLinkResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [copied, setCopied] = useState(false);

  const formIsValid = useMemo(() => {
    const amount = Number(form.amountUsd);
    return amount > 0 && amount <= 10_000 && isValidAddress(form.payTo.trim());
  }, [form.amountUsd, form.payTo]);

  const patchForm = (patch: Partial<PaymentLinkInput>) => {
    setForm((current) => ({ ...current, ...patch }));
    setResult(null);
    setError(null);
  };

  const createLink = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!formIsValid) {
      setError("Enter a positive amount and a valid Algorand receiving address.");
      return;
    }

    setIsCreating(true);
    setError(null);
    try {
      const response = await fetch("/api/payment-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!response.ok) throw new Error(await messageFromResponse(response));
      setResult((await response.json()) as PaymentLinkResponse);
    } catch (creationError) {
      setError(creationError instanceof Error ? creationError.message : "Payment link creation failed.");
    } finally {
      setIsCreating(false);
    }
  };

  const copyPaymentLink = async () => {
    if (!result) return;
    await copyText(result.paymentUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="app-page">
      <BrandHeader />
      <main className="seller-main">
        <section className="seller-intro">
          <p className="eyebrow"><BadgeCheck /> Seller checkout</p>
          <h1>Create a payment link</h1>
          <p>Set the amount and receiving wallet once. Share one protected link with your buyer.</p>
          <ol className="flow-summary" aria-label="Seller payment flow">
            <li className="current"><span>1</span><div><strong>Set terms</strong><small>Amount and wallet</small></div></li>
            <li><span>2</span><div><strong>Share link</strong><small>Signed and tamper-proof</small></div></li>
            <li><span>3</span><div><strong>Get paid</strong><small>Onchain receipt</small></div></li>
          </ol>
        </section>

        <section className="seller-workspace" aria-label="Create a payment link">
          <form className="payment-form" onSubmit={createLink}>
            <div className="section-title">
              <div><span>1</span><h2>Payment details</h2></div>
              <p>Buyer sees these details before connecting a wallet.</p>
            </div>

            <label className="field-label" htmlFor="title">Payment title</label>
            <input id="title" value={form.title} maxLength={80} onChange={(event) => patchForm({ title: event.target.value })} placeholder="Agent service payment" />

            <div className="field-grid">
              <div>
                <label className="field-label" htmlFor="amount">Amount</label>
                <div className="amount-input">
                  <span>$</span>
                  <input id="amount" type="number" min="0.000001" max="10000" step="0.000001" inputMode="decimal" value={form.amountUsd} onChange={(event) => patchForm({ amountUsd: event.target.value })} />
                  <strong>USDC</strong>
                </div>
              </div>
              <div>
                <label className="field-label" htmlFor="network">Network</label>
                <div className="readonly-field" id="network"><span className="network-dot" />Algorand Testnet</div>
              </div>
            </div>

            <label className="field-label" htmlFor="pay-to">Receiving address</label>
            <input id="pay-to" className="mono-input" value={form.payTo} onChange={(event) => patchForm({ payTo: event.target.value })} spellCheck="false" aria-describedby="address-help" />
            <p id="address-help" className={`field-help ${form.payTo && !isValidAddress(form.payTo.trim()) ? "invalid" : ""}`}>
              {form.payTo && !isValidAddress(form.payTo.trim()) ? "This is not a valid Algorand address." : "USDC will settle directly to this wallet."}
            </p>

            <label className="field-label" htmlFor="description">Description <span>Optional</span></label>
            <textarea id="description" rows={3} maxLength={240} value={form.description} onChange={(event) => patchForm({ description: event.target.value })} placeholder="What is this payment for?" />

            {error && <div className="form-error" role="alert">{error}</div>}

            <button className="primary-button" type="submit" disabled={!formIsValid || isCreating}>
              {isCreating ? <LoaderCircle className="spin" /> : <Link2 />}
              {isCreating ? "Creating link" : "Create payment link"}
              {!isCreating && <ArrowRight />}
            </button>
            <p className="submit-note"><LockKeyhole /> Link terms expire in 7 days and cannot be edited after creation.</p>
          </form>

          <aside className="link-output" aria-live="polite">
            <div className="section-title">
              <div><span>2</span><h2>Share with buyer</h2></div>
              <p>Only the person with this link can open the checkout.</p>
            </div>

            {!result ? (
              <div className="output-empty">
                <span><Send /></span>
                <h3>Your payment link will appear here</h3>
                <p>Review the payment terms, then create a secure checkout.</p>
              </div>
            ) : (
              <div className="output-ready">
                <div className="success-heading"><CheckCircle2 /><div><strong>Link ready</strong><small>Expires {new Date(result.request.expiresAt).toLocaleDateString()}</small></div></div>
                <div className="payment-preview"><small>Buyer pays</small><strong>{formatUsd(result.request.amountUsd)}</strong><span>USDC on Algorand Testnet</span></div>
                <label className="field-label" htmlFor="generated-link">Payment link</label>
                <div className="generated-link">
                  <input id="generated-link" readOnly value={result.paymentUrl} />
                  <button type="button" onClick={copyPaymentLink} aria-label="Copy payment link">{copied ? <Check /> : <Copy />}</button>
                </div>
                <div className="output-actions">
                  <button type="button" className="secondary-button" onClick={copyPaymentLink}><Copy />{copied ? "Copied" : "Copy link"}</button>
                  <a className="primary-link" href={result.paymentUrl} target="_blank" rel="noreferrer">Open checkout <ExternalLink /></a>
                </div>
                <div className="integrity-note"><FileLock2 /><p><strong>Terms are signed.</strong><br />Changing the amount or recipient invalidates the link.</p></div>
              </div>
            )}
          </aside>
        </section>

        <section className="trust-strip" aria-label="Payment infrastructure">
          <div><ShieldCheck /><span><strong>Signed request</strong><small>HMAC protected terms</small></span></div>
          <div><WalletCards /><span><strong>Non-custodial</strong><small>Buyer signs in Pera</small></span></div>
          <div><ReceiptText /><span><strong>Onchain receipt</strong><small>GoPlausible settlement</small></span></div>
        </section>
      </main>
      <ProductFooter />
    </div>
  );
}

type CheckoutState = "loading" | "empty" | "ready" | "paying" | "success" | "error";

function BuyerPage() {
  const { activeAddress, availableWallets, signTransactions } = useWallet();
  const token = new URLSearchParams(window.location.search).get("request") ?? "";
  const [paymentLink, setPaymentLink] = useState<PaymentLinkResponse | null>(null);
  const [state, setState] = useState<CheckoutState>(token ? "loading" : "empty");
  const [error, setError] = useState<string | null>(null);
  const [transaction, setTransaction] = useState<string | null>(null);
  const [pasteValue, setPasteValue] = useState("");

  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch(`/api/payment-links?request=${encodeURIComponent(token)}`, { signal: controller.signal });
        if (!response.ok) throw new Error(await messageFromResponse(response));
        setPaymentLink((await response.json()) as PaymentLinkResponse);
        setState("ready");
      } catch (loadError) {
        if (controller.signal.aborted) return;
        setError(loadError instanceof Error ? loadError.message : "This payment link is invalid.");
        setState("error");
      }
    })();
    return () => controller.abort();
  }, [token]);

  const connectWallet = async () => {
    const wallet = availableWallets.find((candidate) => candidate.id === "pera");
    if (!wallet) {
      setError("Pera Wallet is not available in this browser.");
      return;
    }
    try {
      setError(null);
      await wallet.connect();
    } catch (walletError) {
      setError(walletError instanceof Error ? walletError.message : "Wallet connection failed.");
    }
  };

  const pay = async () => {
    if (!paymentLink || !activeAddress) return;
    setState("paying");
    setError(null);
    try {
      const { fetchOfficialX402Challenge } = await import("./lib/okx-wallet");
      const { payOfficialX402WithAlgorandWallet } = await import("./lib/algorand-wallet");
      const challenge = await fetchOfficialX402Challenge(paymentLink.resourceUrl);

      if (challenge.requirement.payTo !== paymentLink.request.payTo) {
        throw new Error("Security check failed: the x402 recipient does not match this payment link.");
      }
      if (Math.abs(challenge.requirement.amountUsd - Number(paymentLink.request.amountUsd)) > 0.0000001) {
        throw new Error("Security check failed: the x402 amount does not match this payment link.");
      }

      const paid = await payOfficialX402WithAlgorandWallet({
        targetUrl: paymentLink.resourceUrl,
        address: activeAddress,
        signTransactions,
        amountUsd: challenge.requirement.amountUsd,
      });
      setTransaction(paid.settlement.txHash);
      setState("success");
    } catch (paymentError) {
      setError(paymentError instanceof Error ? paymentError.message : "Payment failed.");
      setState("ready");
    }
  };

  const openPastedLink = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      const parsed = new URL(pasteValue);
      const request = parsed.searchParams.get("request");
      if (!request) throw new Error("No payment request was found in this link.");
      window.location.assign(`/pay?request=${encodeURIComponent(request)}`);
    } catch (pasteError) {
      setError(pasteError instanceof Error ? pasteError.message : "Enter a valid AgentPay link.");
    }
  };

  const request = paymentLink?.request;
  const isPaying = state === "paying";

  return (
    <div className="app-page checkout-page">
      <BrandHeader buyer />
      <main className="buyer-main">
        <a className="back-link" href="/"><ArrowLeft /> Seller workspace</a>

        {state === "empty" && (
          <section className="checkout-shell empty-checkout">
            <span className="checkout-icon"><Link2 /></span>
            <h1>Open a payment link</h1>
            <p>Paste the AgentPay link shared by your seller to review and pay.</p>
            <form onSubmit={openPastedLink}>
              <label className="field-label" htmlFor="paste-link">Payment link</label>
              <input id="paste-link" value={pasteValue} onChange={(event) => setPasteValue(event.target.value)} placeholder="https://agentpay-firewall.vercel.app/pay?request=..." />
              {error && <div className="form-error" role="alert">{error}</div>}
              <button className="primary-button" type="submit" disabled={!pasteValue.trim()}>Open checkout <ArrowRight /></button>
            </form>
          </section>
        )}

        {state === "loading" && (
          <section className="checkout-shell checkout-loading" aria-label="Loading payment request">
            <LoaderCircle className="spin" /><h1>Verifying payment link</h1><p>Checking the seller's signed payment terms.</p>
          </section>
        )}

        {state === "error" && (
          <section className="checkout-shell empty-checkout">
            <span className="checkout-icon error-icon"><FileLock2 /></span>
            <h1>Payment link unavailable</h1>
            <p>{error || "This link is invalid or has expired."}</p>
            <a className="secondary-link" href="/pay"><RefreshCcw /> Try another link</a>
          </section>
        )}

        {request && state !== "success" && (
          <section className="checkout-shell">
            <div className="checkout-status"><LockKeyhole /><span>Verified seller request</span></div>
            <div className="checkout-heading">
              <div className="merchant-mark"><Store /></div>
              <div><small>Payment to</small><h1>{request.title}</h1><p>{request.description || "Secure x402 payment request"}</p></div>
            </div>
            <div className="checkout-amount"><small>Amount due</small><strong>{formatUsd(request.amountUsd)}</strong><span>USDC</span></div>
            <dl className="checkout-details">
              <div><dt>Network</dt><dd><span className="network-dot" />Algorand Testnet</dd></div>
              <div><dt>Recipient</dt><dd title={request.payTo}>{shortHash(request.payTo, 12, 8)}</dd></div>
              <div><dt>Link expires</dt><dd>{new Date(request.expiresAt).toLocaleString()}</dd></div>
            </dl>
            {error && <div className="form-error" role="alert">{error}</div>}
            {!activeAddress ? (
              <button className="pay-button" type="button" onClick={connectWallet} disabled={isPaying}><WalletCards />Connect Pera Wallet</button>
            ) : (
              <>
                <div className="connected-wallet"><span><CheckCircle2 /> Wallet connected</span><strong>{shortHash(activeAddress, 10, 6)}</strong></div>
                <button className="pay-button" type="button" onClick={pay} disabled={isPaying}>
                  {isPaying ? <LoaderCircle className="spin" /> : <WalletCards />}
                  {isPaying ? "Confirm in Pera Wallet" : `Pay ${formatUsd(request.amountUsd)}`}
                </button>
              </>
            )}
            <p className="checkout-protection"><ShieldCheck /> AgentPay verifies the signed amount and recipient before your wallet opens.</p>
          </section>
        )}

        {request && state === "success" && transaction && (
          <section className="checkout-shell success-checkout">
            <span className="success-icon"><Check /></span>
            <p className="eyebrow">Payment complete</p>
            <h1>{formatUsd(request.amountUsd)} paid</h1>
            <p>Your USDC payment settled on Algorand Testnet.</p>
            <div className="receipt-box"><ReceiptText /><div><small>Transaction receipt</small><strong>{shortHash(transaction, 14, 10)}</strong></div></div>
            <a className="primary-link wide" href={`${ALGORAND_TESTNET_LORA_URL}/transaction/${transaction}`} target="_blank" rel="noreferrer">View on Lora <ExternalLink /></a>
          </section>
        )}

        <div className="checkout-trust"><LockKeyhole /><span>Non-custodial checkout</span><span>·</span><span>Settled by {new URL(GOPLAUSIBLE_FACILITATOR_URL).hostname}</span></div>
      </main>
      <ProductFooter />
    </div>
  );
}

export default function App() {
  return window.location.pathname.startsWith("/pay") ? <BuyerPage /> : <SellerPage />;
}
