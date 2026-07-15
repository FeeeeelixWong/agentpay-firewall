import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  LockKeyhole,
  Play,
  RefreshCcw,
  ShieldCheck,
  ShieldX,
  WalletCards,
  XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  createSettlementResponse,
  createPaymentPayload,
  decodeBase64Json,
  encodeBase64Json,
  shortHash,
  type PaidApiResponse,
  type PaymentPayload,
  type PaymentRequirement,
  type SettlementResponse,
} from "./lib/protocol";
import {
  defaultPolicy,
  evaluatePayment,
  type AgentPolicy,
  type PolicyDecision,
} from "./lib/policy";
import { scenarios, type ScenarioId } from "./lib/scenarios";

type StageState = "pending" | "active" | "done" | "blocked" | "error" | "review";

type FlowStage = {
  id: string;
  label: string;
  description: string;
  state: StageState;
};

type AuditEvent = {
  id: string;
  time: string;
  title: string;
  detail: string;
  status: "approved" | "blocked" | "settled" | "review" | "info";
};

type RunResult = {
  requirement?: PaymentRequirement;
  decision?: PolicyDecision;
  payload?: PaymentPayload;
  settlement?: SettlementResponse;
  apiResult?: PaidApiResponse;
  paymentRequiredHeader?: string;
  paymentSignatureHeader?: string;
  paymentResponseHeader?: string;
  transport?: "server" | "browser-sim";
};

const initialStages: FlowStage[] = [
  {
    id: "challenge",
    label: "Challenge",
    description: "Resource returns HTTP 402 with PAYMENT-REQUIRED.",
    state: "pending",
  },
  {
    id: "policy",
    label: "Policy check",
    description: "Wallet checks budget, allowlist, network, asset, and risk.",
    state: "pending",
  },
  {
    id: "sign",
    label: "Sign",
    description: "Agent signer creates PAYMENT-SIGNATURE only if allowed.",
    state: "pending",
  },
  {
    id: "retry",
    label: "Retry",
    description: "Client retries the paid API call with the signed payload.",
    state: "pending",
  },
  {
    id: "settle",
    label: "Settle",
    description: "Server verifies, settles, and returns PAYMENT-RESPONSE.",
    state: "pending",
  },
];

const statusIcon = {
  pending: Clock3,
  active: Activity,
  done: CheckCircle2,
  blocked: ShieldX,
  error: XCircle,
  review: AlertTriangle,
};

const statusLabel = {
  pending: "Pending",
  active: "Running",
  done: "Done",
  blocked: "Blocked",
  error: "Error",
  review: "Review",
};

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(amount);

const now = () =>
  new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date());

const updateStage = (stages: FlowStage[], id: string, state: StageState) =>
  stages.map((stage) => (stage.id === id ? { ...stage, state } : stage));

const resetFrom = (stages: FlowStage[], activeId: string) => {
  const activeIndex = stages.findIndex((stage) => stage.id === activeId);

  return stages.map((stage, index) =>
    index > activeIndex ? { ...stage, state: "pending" as StageState } : stage,
  );
};

function App() {
  const [policy, setPolicy] = useState<AgentPolicy>(defaultPolicy);
  const [stages, setStages] = useState<FlowStage[]>(initialStages);
  const [activeScenario, setActiveScenario] = useState<ScenarioId>("allowed-risk-scan");
  const [result, setResult] = useState<RunResult>({});
  const [auditLog, setAuditLog] = useState<AuditEvent[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedScenario = scenarios[activeScenario];
  const remainingBudget = Math.max(policy.dailyBudgetUsd - policy.spentTodayUsd, 0);

  const stageSummary = useMemo(() => {
    const completed = stages.filter((stage) => stage.state === "done").length;
    const blocked = stages.some((stage) => stage.state === "blocked");
    const review = stages.some((stage) => stage.state === "review");

    if (blocked) return "Blocked before signing";
    if (review) return "Waiting for human approval";
    if (completed === stages.length) return "Payment settled";
    if (isRunning) return "Running x402 flow";
    return "Ready";
  }, [isRunning, stages]);

  const addAuditEvent = (event: Omit<AuditEvent, "id" | "time">) => {
    setAuditLog((events) => [
      {
        ...event,
        id: `${Date.now()}-${events.length}`,
        time: now(),
      },
      ...events,
    ]);
  };

  const patchPolicy = (patch: Partial<AgentPolicy>) => {
    setPolicy((current) => ({ ...current, ...patch }));
  };

  const runScenario = async (scenarioId: ScenarioId) => {
    const scenario = scenarios[scenarioId];
    setActiveScenario(scenarioId);
    setError(null);
    setResult({});
    setStages(initialStages.map((stage) => ({ ...stage, state: "pending" })));
    setIsRunning(true);

    try {
      setStages((current) => updateStage(current, "challenge", "active"));
      let transport: RunResult["transport"] = "server";
      let paymentRequiredHeader: string | undefined;
      let requirement: PaymentRequirement;

      try {
        if (window.location.hostname.endsWith("github.io")) {
          throw new Error("Static GitHub Pages host");
        }

        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => controller.abort(), 2_000);
        const challengeResponse = await fetch(scenario.resourcePath, {
          signal: controller.signal,
        });
        window.clearTimeout(timeoutId);

        if (challengeResponse.status !== 402) {
          throw new Error(`Expected a 402 challenge but received ${challengeResponse.status}.`);
        }

        paymentRequiredHeader = challengeResponse.headers.get("PAYMENT-REQUIRED") ?? undefined;

        if (!paymentRequiredHeader) {
          throw new Error("Missing PAYMENT-REQUIRED header from paid resource.");
        }

        requirement = decodeBase64Json<PaymentRequirement>(paymentRequiredHeader);
      } catch {
        transport = "browser-sim";
        requirement = scenario.requirement;
        paymentRequiredHeader = encodeBase64Json(requirement);
      }

      setResult({ requirement, paymentRequiredHeader, transport });
      setStages((current) => updateStage(current, "challenge", "done"));

      setStages((current) => updateStage(current, "policy", "active"));
      const decision = evaluatePayment(requirement, policy);
      setResult((current) => ({ ...current, decision }));

      if (decision.status === "blocked") {
        setStages((current) =>
          resetFrom(updateStage(updateStage(current, "policy", "blocked"), "sign", "blocked"), "sign"),
        );
        addAuditEvent({
          title: "Payment blocked",
          detail: `${requirement.serviceName} requested ${formatCurrency(requirement.amountUsd)}. ${decision.reason}`,
          status: "blocked",
        });
        return;
      }

      if (decision.status === "manual_review") {
        setStages((current) =>
          resetFrom(updateStage(updateStage(current, "policy", "review"), "sign", "review"), "sign"),
        );
        addAuditEvent({
          title: "Manual approval required",
          detail: `${requirement.serviceName} requested ${formatCurrency(requirement.amountUsd)}. ${decision.reason}`,
          status: "review",
        });
        return;
      }

      setStages((current) => updateStage(current, "policy", "done"));

      setStages((current) => updateStage(current, "sign", "active"));
      const payload = createPaymentPayload(requirement, decision.id);
      const paymentSignatureHeader = encodeBase64Json(payload);
      setResult((current) => ({ ...current, payload, paymentSignatureHeader }));
      setStages((current) => updateStage(current, "sign", "done"));

      setStages((current) => updateStage(current, "retry", "active"));
      let paymentResponseHeader: string | undefined;
      let settlement: SettlementResponse;
      let apiResult: PaidApiResponse;

      if (transport === "browser-sim") {
        setStages((current) => updateStage(current, "retry", "done"));
        setStages((current) => updateStage(current, "settle", "active"));
        settlement = createSettlementResponse(requirement);
        paymentResponseHeader = encodeBase64Json(settlement);
        apiResult = scenario.result;
      } else {
        const paidResponse = await fetch(scenario.resourcePath, {
          headers: {
            "PAYMENT-SIGNATURE": paymentSignatureHeader,
          },
        });
        setStages((current) => updateStage(current, "retry", paidResponse.ok ? "done" : "error"));

        if (!paidResponse.ok) {
          throw new Error(`Paid retry failed with ${paidResponse.status}.`);
        }

        setStages((current) => updateStage(current, "settle", "active"));
        paymentResponseHeader = paidResponse.headers.get("PAYMENT-RESPONSE") ?? undefined;

        if (!paymentResponseHeader) {
          throw new Error("Missing PAYMENT-RESPONSE header after paid retry.");
        }

        const body = (await paidResponse.json()) as {
          data: PaidApiResponse;
          receipt: SettlementResponse;
        };
        settlement = decodeBase64Json<SettlementResponse>(paymentResponseHeader);
        apiResult = body.data;
      }

      setResult((current) => ({
        ...current,
        apiResult,
        settlement,
        paymentResponseHeader,
      }));
      setPolicy((current) => ({
        ...current,
        spentTodayUsd: Number((current.spentTodayUsd + requirement.amountUsd).toFixed(2)),
      }));
      setStages((current) => updateStage(current, "settle", "done"));
      addAuditEvent({
        title: transport === "browser-sim" ? "Payment simulated" : "Payment settled",
        detail: `${requirement.serviceName} ${transport === "browser-sim" ? "simulated" : "settled"} ${formatCurrency(requirement.amountUsd)} with receipt ${shortHash(settlement.txHash)}.`,
        status: "settled",
      });
    } catch (runError) {
      const message = runError instanceof Error ? runError.message : "Unknown flow error";
      setError(message);
      setStages((current) => {
        const active = current.find((stage) => stage.state === "active");
        return active ? updateStage(current, active.id, "error") : current;
      });
      addAuditEvent({
        title: "Flow failed",
        detail: message,
        status: "blocked",
      });
    } finally {
      setIsRunning(false);
    }
  };

  const resetDemo = () => {
    setPolicy(defaultPolicy);
    setStages(initialStages.map((stage) => ({ ...stage, state: "pending" })));
    setResult({});
    setAuditLog([]);
    setError(null);
    setActiveScenario("allowed-risk-scan");
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">x402 blockchain track</p>
          <h1>AgentPay Firewall</h1>
          <p className="lede">
            A policy wallet that lets AI agents pay for HTTP 402 resources without giving them
            unlimited signing power.
          </p>
        </div>
        <div className="status-card" aria-live="polite">
          <span className="status-dot" aria-hidden="true" />
          <span>{stageSummary}</span>
        </div>
      </header>

      <section className="workspace-grid" aria-label="AgentPay Firewall demo">
        <aside className="panel policy-panel">
          <div className="section-heading">
            <ShieldCheck aria-hidden="true" />
            <div>
              <h2>Policy Wallet</h2>
              <p>Rules the agent must pass before it can sign.</p>
            </div>
          </div>

          <div className="metric-row">
            <div>
              <span>Spent today</span>
              <strong>{formatCurrency(policy.spentTodayUsd)}</strong>
            </div>
            <div>
              <span>Remaining</span>
              <strong>{formatCurrency(remainingBudget)}</strong>
            </div>
          </div>

          <div className="form-stack">
            <label>
              <span>Max per request</span>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={policy.maxPerRequestUsd}
                onChange={(event) =>
                  patchPolicy({ maxPerRequestUsd: Number(event.currentTarget.value) })
                }
              />
            </label>
            <label>
              <span>Daily budget</span>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={policy.dailyBudgetUsd}
                onChange={(event) =>
                  patchPolicy({ dailyBudgetUsd: Number(event.currentTarget.value) })
                }
              />
            </label>
            <label>
              <span>Human approval above</span>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={policy.manualApprovalAboveUsd}
                onChange={(event) =>
                  patchPolicy({ manualApprovalAboveUsd: Number(event.currentTarget.value) })
                }
              />
            </label>
          </div>

          <div className="token-list" aria-label="Allowed services">
            {policy.allowedServices.map((service) => (
              <span key={service}>{service}</span>
            ))}
          </div>

          <div className="guardrail-note">
            <LockKeyhole aria-hidden="true" />
            <p>
              The wallet blocks before signing. The paid API never receives a signature when policy
              fails.
            </p>
          </div>
        </aside>

        <section className="panel command-panel">
          <div className="section-heading">
            <WalletCards aria-hidden="true" />
            <div>
              <h2>Agent Request</h2>
              <p>Select what the agent is trying to buy.</p>
            </div>
          </div>

          <div className="scenario-list" role="list" aria-label="Payment scenarios">
            {(Object.keys(scenarios) as ScenarioId[]).map((scenarioId) => {
              const scenario = scenarios[scenarioId];
              const isSelected = scenarioId === activeScenario;

              return (
                <button
                  key={scenario.id}
                  type="button"
                  className={`scenario-button ${isSelected ? "selected" : ""}`}
                  onClick={() => setActiveScenario(scenarioId)}
                  disabled={isRunning}
                >
                  <span>{scenario.label}</span>
                  <small>{formatCurrency(scenario.requirement.amountUsd)}</small>
                </button>
              );
            })}
          </div>

          <div className="intent-box">
            <span>Intent</span>
            <p>{selectedScenario.intent}</p>
          </div>

          <div className="action-row">
            <button
              type="button"
              className="primary-action"
              onClick={() => runScenario(activeScenario)}
              disabled={isRunning}
              aria-busy={isRunning}
            >
              <Play aria-hidden="true" />
              {isRunning ? "Running flow" : "Run x402 flow"}
            </button>
            <button type="button" className="secondary-action" onClick={resetDemo} disabled={isRunning}>
              <RefreshCcw aria-hidden="true" />
              Reset
            </button>
          </div>

          {error ? (
            <div className="error-banner" role="alert">
              <AlertTriangle aria-hidden="true" />
              <span>{error}</span>
            </div>
          ) : null}
        </section>

        <section className="panel flow-panel">
          <div className="section-heading">
            <Activity aria-hidden="true" />
            <div>
              <h2>x402 Lifecycle</h2>
              <p>Challenge, policy check, sign, retry, settle.</p>
            </div>
          </div>

          <ol className="stage-list">
            {stages.map((stage) => {
              const Icon = statusIcon[stage.state];
              return (
                <li key={stage.id} className={`stage-item ${stage.state}`}>
                  <div className="stage-icon" aria-hidden="true">
                    <Icon />
                  </div>
                  <div>
                    <div className="stage-title">
                      <strong>{stage.label}</strong>
                      <span>{statusLabel[stage.state]}</span>
                    </div>
                    <p>{stage.description}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      </section>

      <section className="details-grid">
        <section className="panel transcript-panel">
          <div className="section-heading">
            <ClipboardCheck aria-hidden="true" />
            <div>
              <h2>Protocol Transcript</h2>
              <p>Headers generated during the latest run.</p>
            </div>
          </div>

          {result.transport === "browser-sim" ? (
            <div className="transport-note">
              Static fallback is active because no serverless API responded. Local and Vercel runs
              use the real `/api/paid/*` resource server.
            </div>
          ) : null}

          <div className="transcript-stack">
            <TranscriptLine
              label="PAYMENT-REQUIRED"
              value={result.paymentRequiredHeader}
              fallback="Run a scenario to capture the 402 challenge."
            />
            <TranscriptLine
              label="PAYMENT-SIGNATURE"
              value={result.paymentSignatureHeader}
              fallback="Appears only after policy approves signing."
            />
            <TranscriptLine
              label="PAYMENT-RESPONSE"
              value={result.paymentResponseHeader}
              fallback="Appears after the paid retry settles."
            />
          </div>
        </section>

        <section className="panel decision-panel">
          <div className="section-heading">
            <ShieldCheck aria-hidden="true" />
            <div>
              <h2>Decision Detail</h2>
              <p>Why the wallet signed or refused.</p>
            </div>
          </div>

          {result.decision ? (
            <div className="decision-content">
              <div className={`decision-banner ${result.decision.status}`}>
                {result.decision.status === "approved" ? (
                  <CheckCircle2 aria-hidden="true" />
                ) : result.decision.status === "blocked" ? (
                  <ShieldX aria-hidden="true" />
                ) : (
                  <AlertTriangle aria-hidden="true" />
                )}
                <span>{result.decision.reason}</span>
              </div>
              <ul className="check-list">
                {result.decision.checks.map((check) => (
                  <li key={check.label} className={check.status}>
                    <span>{check.label}</span>
                    <strong>{check.detail}</strong>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <EmptyState text="No policy decision yet. Run an x402 flow to evaluate a payment request." />
          )}
        </section>

        <section className="panel receipt-panel">
          <div className="section-heading">
            <CheckCircle2 aria-hidden="true" />
            <div>
              <h2>Receipt</h2>
              <p>Paid API result and settlement evidence.</p>
            </div>
          </div>

          {result.settlement && result.apiResult ? (
            <div className="receipt-content">
              <div className="receipt-total">
                <span>Settled</span>
                <strong>{formatCurrency(result.settlement.amountUsd)}</strong>
              </div>
              <dl>
                <div>
                  <dt>Payment id</dt>
                  <dd>{result.settlement.paymentId}</dd>
                </div>
                <div>
                  <dt>{result.settlement.onchain ? "Onchain tx" : "Receipt hash"}</dt>
                  <dd>{shortHash(result.settlement.txHash, 14, 8)}</dd>
                </div>
                <div>
                  <dt>Receipt mode</dt>
                  <dd>
                    {result.settlement.receiptKind === "x402-facilitator"
                      ? "Official x402 facilitator"
                      : "Demo facilitator"}
                  </dd>
                </div>
                {result.settlement.facilitatorUrl ? (
                  <div>
                    <dt>Facilitator</dt>
                    <dd>{result.settlement.facilitatorUrl}</dd>
                  </div>
                ) : null}
                {result.settlement.explorerUrl ? (
                  <div>
                    <dt>Explorer</dt>
                    <dd>
                      <a
                        className="receipt-link"
                        href={result.settlement.explorerUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        View transaction
                      </a>
                    </dd>
                  </div>
                ) : null}
                <div>
                  <dt>API result</dt>
                  <dd>{result.apiResult.summary}</dd>
                </div>
                <div>
                  <dt>Evidence</dt>
                  <dd>{result.settlement.evidenceNote}</dd>
                </div>
              </dl>
            </div>
          ) : (
            <EmptyState text="A receipt appears after an approved request is retried and settled." />
          )}
        </section>

        <section className="panel audit-panel">
          <div className="section-heading">
            <ClipboardCheck aria-hidden="true" />
            <div>
              <h2>Audit Log</h2>
              <p>Every approval, block, and settlement is recorded.</p>
            </div>
          </div>

          {auditLog.length > 0 ? (
            <ul className="audit-list">
              {auditLog.map((event) => (
                <li key={event.id} className={event.status}>
                  <time>{event.time}</time>
                  <div>
                    <strong>{event.title}</strong>
                    <p>{event.detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState text="No audit events yet. Run an allowed or blocked payment to create one." />
          )}
        </section>
      </section>
    </main>
  );
}

function TranscriptLine({
  label,
  value,
  fallback,
}: {
  label: string;
  value?: string;
  fallback: string;
}) {
  return (
    <div className="transcript-line">
      <span>{label}</span>
      <code>{value ? `${value.slice(0, 86)}${value.length > 86 ? "..." : ""}` : fallback}</code>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="empty-state">
      <Clock3 aria-hidden="true" />
      <p>{text}</p>
    </div>
  );
}

export default App;
