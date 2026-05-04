# 0002 — Cost and iteration budgets

## Status

Accepted

## Context

LLM agents fail in ways traditional software doesn't:

- **They loop.** A tool returns an unexpected error; the model retries; the retry produces a slightly different malformed call; the loop continues until something runs out.
- **They burn money.** Each iteration is an API call. A runaway loop with a large context window can spend $40 in a single session before anyone notices.
- **They time out.** Long-running sessions hold connections, rack up latency, and frustrate users.

Production agents without explicit guardrails are a financial and operational liability. The question isn't *whether* to bound them — it's *where*.

Two natural places to enforce budgets:

1. **External middleware** (rate-limit proxies, billing watchdogs)
2. **Internal to the orchestrator**

External enforcement is necessary for defense in depth but insufficient on its own — by the time a billing alert fires, the damage is done. Internal enforcement gives the agent a graceful exit and reports it as a structured outcome.

## Decision

Enforce two hard caps inside the orchestrator loop:

- `maxIterations` (default 10) — caps how many times the loop can run, preventing runaway tool-use cycles.
- `maxCostUsd` (default $1.00) — sums an estimated cost from token usage on each iteration, halting before the next call when the cap is exceeded.

Budget exhaustion returns an `AgentResult` with status `iteration_limit` or `budget_exceeded` rather than throwing. Callers must handle these as outcomes, not as exceptions.

```ts
totalCostUsd += estimateCost(this.model, response.usage);
if (totalCostUsd > this.maxCostUsd) {
  await this.audit.log({ traceId, type: "agent.budget_exceeded", ... });
  return { status: "budget_exceeded", reason: ..., ... };
}
```

## Consequences

**Easier:**

- Cost predictability per session is bounded by `maxCostUsd`, regardless of model or prompt.
- Operators can tune budgets per-deployment via environment variables.
- Audit log captures budget exhaustion as a first-class event, useful for triaging which prompts run hot.
- Forced explicit handling at the call site — every consumer of `AgentResult` switches on `status`.

**Harder:**

- Cost estimation is approximate. The placeholder pricing in `estimateCost` doesn't reflect every model's true rates and ignores cached tokens. Production must replace this with a real per-model pricing table loaded from configuration.
- Aggressive limits can cut off legitimate complex queries. A user asking the agent to compare multiple benefit plans might need 5+ tool calls; defaults must allow that. Tunable per-deployment is a partial answer; per-user or per-tier limits would be more flexible.
- Token-based cost ignores other costs (network egress, downstream API calls). Out of scope for now but worth flagging.
