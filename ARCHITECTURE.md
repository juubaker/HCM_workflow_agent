# Architecture

## System overview

The agent is organized as six tiers, top to bottom:

1. **Client surfaces** — Web UI, Slack bot, REST API. All speak HTTP/JSON to the gateway.
2. **API gateway** — terminates TLS, validates auth tokens, applies RBAC, enforces rate limits, and constructs an `AgentContext` (user identity + roles) that flows through everything below.
3. **Agent core** — three components that talk to each other on every iteration:
   - **Policy engine** — runs *before* every tool call. Composable rules answer one question: "is this user allowed to do this thing?"
   - **Orchestrator** — the LLM tool-use loop. Manages messages, tool dispatch, retries, and budget enforcement.
   - **Claude API client** — abstracted behind the orchestrator. Swappable per-deployment.
4. **Tool registry** — typed handlers exposed to the LLM as JSON schemas. The registry validates input, dispatches to the handler, and converts results back to tool-result blocks.
5. **Integration connectors** — Oracle HCM, Workday, ServiceNow. Each implements a narrow interface (e.g., `HCMClient`) so the agent code never depends on a vendor SDK directly.
6. **Audit log** — append-only record of every tool call, every policy decision, every error. This is the SOX/SOC2 story.

## Why this shape

### Policy is a gate, not a wrapper

You could put authorization checks inside each tool handler. We don't. Reasons:

- **Forgetting is the default failure mode.** With 50 tools, three of them will skip the check. Centralizing the gate means a new tool inherits org-wide rules for free.
- **Cross-cutting rules don't fit inside tools.** "No enrollment outside the open window" applies to multiple tools but lives in *none* of them. The policy engine owns it.
- **Auditing.** Every denial is logged uniformly with a reason. No tool-specific log formats.
- **The LLM can recover.** When policy denies a call, we surface that as `POLICY_DENIED: <reason>` in the tool result. The model reads it and adapts (e.g., "I can't access that employee's record — you'd need a manager to do this").

### Budgets are first-class

The orchestrator tracks cost-per-iteration and total iterations. Both have hard caps. This is non-negotiable in production — agents can loop, models can hallucinate tool arguments that cause retries, and a single bad session can cost $40+ without these guards.

### The integration layer is an interface, not a SDK

The orchestrator never imports `@oracle/hcm-cloud` or `@workday/sdk`. It depends on `HCMClient`, an interface this repo satisfies with `MockHCMClient` for development. Production deployments wire in the real implementation. This is what makes the eval suite runnable on a laptop.

## Request lifecycle

A user message flows through the system like this:

1. **Gateway** — request arrives, JWT validated, `AgentContext` constructed (`userId`, `roles`).
2. **Orchestrator** — appends user message to conversation, calls Claude with the tool schemas.
3. **Claude response** — either a final text answer (loop ends) or one or more `tool_use` blocks.
4. **For each tool call:**
   - Policy engine evaluates the request. Denied → result becomes `POLICY_DENIED: ...`, no tool runs.
   - Allowed → tool registry dispatches to the handler. Handler hits the integration layer.
   - Result (success or error) is logged to the audit store.
5. **Tool results** are appended to the conversation; orchestrator calls Claude again.
6. **Loop continues** until `end_turn`, iteration cap, or budget cap.
7. **Final result** is returned to the gateway, which returns it to the client.

Every step writes to the audit log. The trace ID ties them together.

## Extension points

| To add | Edit |
| --- | --- |
| A new tool | Add a `ToolHandler` in `src/tools/` and register it in `index.ts` |
| A new policy rule | Add a `PolicyRule` in `src/policy/rules.ts` and `.use()` it |
| A new integration | Define an interface, ship a mock + real implementation |
| A new eval case | Add to `evals/cases.json` |
| A new client surface | Wire to the existing orchestrator — orchestrator is transport-agnostic |
