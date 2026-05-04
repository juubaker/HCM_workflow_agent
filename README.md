# Enterprise Workflow Agent

> A production-grade reference implementation of an enterprise HCM workflow agent — built around the things that actually matter when AI agents leave the demo and meet real systems: policy enforcement, tool isolation, cost budgets, audit trails, and behavioral evals.

This is not an LLM-wrapper. It's an agent system designed the way a senior platform team would build one for Workday, Salesforce, or ServiceNow — with the architectural decisions, observability primitives, and test infrastructure that distinguish a portfolio demo from something that could actually ship.

## Table of contents

- [What's interesting here](#whats-interesting-here)
- [Demo](#demo)
- [Architecture](#architecture)
- [Quick start](#quick-start)
- [Features](#features)
- [Project structure](#project-structure)
- [Configuration](#configuration)
- [Usage](#usage)
- [Tools the agent can call](#tools-the-agent-can-call)
- [Notable design decisions](#notable-design-decisions)
- [Tech stack](#tech-stack)
- [Production hardening checklist](#production-hardening-checklist)
- [Roadmap](#roadmap)
- [License](#license)

## What's interesting here

Most agent demos look the same: one file, a `while` loop, three or four tool functions. This repo is structured to highlight five things that are conspicuously absent from typical portfolio projects:

1. **A centralized policy engine** that gates every tool call before it runs. Composable rules. First-deny-wins. New tools inherit org-wide rules for free.
2. **Explicit cost and iteration budgets** enforced inside the orchestrator loop. Budget exhaustion is a graceful return value, not a crash.
3. **Integration interfaces, not vendor SDKs.** The agent depends on `HCMClient`; the mock and the real Oracle HCM client both implement it. Swap without touching agent code.
4. **An eval harness alongside unit tests.** Unit tests verify code; evals verify behavior — *did the model decide to call the right tool with the right args?*
5. **An append-only audit log** capturing every tool call, policy decision, and error. This is the SOC2/SOX story.

The orchestrator is ~165 lines. Most of the value is in *what doesn't happen* — wrong-employee tool calls get blocked at the policy gate, runaway loops get killed by the iteration limit, every action is logged immutably, and the LLM provider is abstracted behind one client.

## Demo

A typical interaction in the CLI:

```text
$ npm run dev
Enterprise Workflow Agent
User: emp-001  Roles: employee, manager
Type 'exit' to quit.

> What benefits plans are available to me?

Here are the plans available for the current open enrollment period:

• BlueShield HMO — $180/mo, network HMO with $25 copay
• BlueShield PPO — $320/mo, flexible PPO with out-of-network coverage
• Delta Dental Basic — $25/mo, preventive plus basic restorative
• VSP Vision — $12/mo, annual exam plus frames every 24 months
• Fidelity 401(k) — pre-tax retirement, up to 6% company match

[trace=a4f2b91c iter=2 cost=$0.0064]

> Show me emp-002's PTO balance

emp-002 currently has 88 hours accrued, 24 used, and 0 pending —
a net balance of 64 hours.

[trace=8d3e0f47 iter=2 cost=$0.0058]
```

And the same query as a non-manager (policy denial cleanly explained back to the user):

```text
$ npm run dev
User: emp-001  Roles: employee

> Show me emp-002's PTO balance

I can't look up another employee's PTO balance — that's restricted
to managers and HR admins. If you need this information, please ask
your manager or contact HR directly.

[trace=b7c1d022 iter=2 cost=$0.0061]
```

The audit log captured all four tool attempts — including the denied one with its reason.

## Architecture

Six tiers, top to bottom:

```text
┌─────────────────────────────────────────────────────────┐
│  Web UI       Slack bot       REST API                  │  Client surfaces
└──────┬─────────────┬─────────────┬──────────────────────┘
       │             │             │
       ▼             ▼             ▼
┌─────────────────────────────────────────────────────────┐
│              API gateway (auth, RBAC, rate limits)      │
└──────────────────────────┬──────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│   ┌───────────┐    ┌──────────────┐    ┌──────────────┐ │
│   │ Policy    │◄──►│ Orchestrator │◄──►│ Claude API   │ │  Agent core
│   │ engine    │    │   (loop)     │    │              │ │
│   └───────────┘    └──────┬───────┘    └──────────────┘ │
└──────────────────────────┬┴─────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│         Tool registry (schema-validated dispatch)       │
└──────┬─────────────┬─────────────┬──────────────────────┘
       │             │             │
       ▼             ▼             ▼
┌─────────────────────────────────────────────────────────┐
│  Oracle HCM    Workday    ServiceNow                    │  Integrations
└──────┬─────────────┬─────────────┬──────────────────────┘
       │             │             │
       ▼             ▼             ▼
┌─────────────────────────────────────────────────────────┐
│              Immutable audit log (JSONL)                │
└─────────────────────────────────────────────────────────┘
```

The purple-box agent core is the differentiator. Notice the bidirectional arrow between the orchestrator and the policy engine — every tool call is gated, and policy denials become tool errors the LLM can recover from gracefully.

For a deeper walkthrough see [`ARCHITECTURE.md`](./ARCHITECTURE.md).

## Quick start

```bash
git clone <this-repo>
cd enterprise-workflow-agent
npm install
cp .env.example .env       # add your ANTHROPIC_API_KEY

npm run dev                # interactive CLI
npm run server             # REST API on :3000
npm run web                # Operator Console dashboard on :5173 (requires server)
npm run eval               # run behavioral evals
npm test                   # run unit tests
```

Requirements: Node.js 20+, an Anthropic API key. The dashboard is a separate Vite + React app under `web/` — install its deps with `npm run web:install` if you skipped the workspace `npm install`.

### Open in VS Code

The project ships with a workspace file. Either:

```bash
code enterprise-workflow-agent.code-workspace
```

…or open the folder directly. Either way, the launch configurations, recommended extensions (Vitest, Prettier, ESLint), and editor settings load automatically.

The Vitest extension exposes every test in the **Testing** panel — click ▶ to run, 🐞 to debug.

## Features

| Feature | Where it lives |
| --- | --- |
| LLM tool-use loop with cost & iteration caps | `src/orchestrator.ts` |
| Schema-validated tool dispatch | `src/tools/registry.ts` |
| Composable policy engine | `src/policy/engine.ts` |
| Built-in policy rules (scope, approval authority, enrollment window) | `src/policy/rules.ts` |
| HCMClient interface with mock implementation | `src/integrations/mock-hcm.ts` |
| File-based audit logger (JSONL) | `src/observability/audit.ts` |
| OpenTelemetry-shaped tracing helper | `src/observability/metrics.ts` |
| CLI entry (REPL) | `src/index.ts` |
| HTTP server (Express) | `src/server.ts` |
| Behavioral eval harness | `evals/runner.ts` |
| Vitest unit tests with fake Anthropic client | `tests/` |

## Project structure

```text
enterprise-workflow-agent/
├── README.md                              ← you are here
├── ARCHITECTURE.md                        Detailed design walkthrough
├── CONTRIBUTING.md                        Dev setup and conventions
├── LICENSE
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── enterprise-workflow-agent.code-workspace
├── .env.example
├── .gitignore
├── .vscode/
│   ├── launch.json                        Run/debug configurations
│   ├── settings.json                      Editor settings
│   └── extensions.json                    Recommended extensions
├── docs/
│   ├── README.md                          Docs index
│   ├── api.md                             HTTP API reference
│   ├── deployment.md                      Production hardening guide
│   ├── adding-a-tool.md                   How to add a new tool
│   ├── adding-a-policy-rule.md            How to add a new policy rule
│   └── adr/                               Architecture Decision Records
│       ├── README.md
│       ├── 0001-policy-engine-as-central-gate.md
│       ├── 0002-cost-and-iteration-budgets.md
│       ├── 0003-hcm-client-as-interface.md
│       └── 0004-evals-alongside-tests.md
├── src/
│   ├── index.ts                           CLI entry (REPL)
│   ├── server.ts                          Express HTTP server
│   ├── orchestrator.ts                    ★ Agent core: tool-use loop
│   ├── prompts.ts                         System prompt
│   ├── config.ts                          Env-based configuration
│   ├── types.ts                           AgentContext, AgentResult
│   ├── policy/
│   │   ├── engine.ts                      ★ Composable policy engine
│   │   └── rules.ts                       Built-in rules
│   ├── tools/
│   │   ├── registry.ts                    Schema-validated dispatcher
│   │   ├── benefits.ts
│   │   ├── timeoff.ts
│   │   └── approvals.ts
│   ├── integrations/
│   │   └── mock-hcm.ts                    Interface + in-memory mock
│   └── observability/
│       ├── audit.ts                       File + console loggers
│       └── metrics.ts                     trace() helper
├── tests/
│   ├── README.md
│   ├── helpers/fake-anthropic.ts          Test double for Anthropic SDK
│   ├── policy.test.ts
│   ├── orchestrator.test.ts
│   ├── tools/registry.test.ts
│   ├── integrations/mock-hcm.test.ts
│   └── observability/audit.test.ts
└── evals/
    ├── README.md
    ├── runner.ts                          Behavioral eval harness
    └── cases.json                         Test cases with assertions
```

## Configuration

All configuration is via environment variables. Copy `.env.example` to `.env` and fill in:

| Variable | Default | Purpose |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | *(required)* | Your Anthropic API key |
| `AGENT_MODEL` | `claude-opus-4-7` | Model used for the agent loop |
| `AGENT_MAX_ITERATIONS` | `10` | Hard cap on tool-use iterations |
| `AGENT_MAX_COST_USD` | `1.00` | Hard cap on per-session token cost |
| `AGENT_TRACE` | `0` | Set to `1` to log durations of LLM calls and tool invocations |
| `AUDIT_PATH` | `./audit.log` | Where the JSONL audit log is written |
| `PORT` | `3000` | HTTP server port |

## Usage

### CLI (REPL)

```bash
npm run dev
```

Type a question; the agent responds. Type `exit` to quit. Identity defaults to `emp-001` with `employee` and `manager` roles — edit `src/index.ts` to change defaults, or wire to real auth.

### HTTP server

```bash
npm run server
```

The server exposes two endpoints:

```bash
# Health check
curl http://localhost:3000/healthz
# → {"ok": true}

# Chat
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -H "x-user-id: emp-001" \
  -H "x-roles: employee,manager" \
  -d '{"message": "What benefits am I enrolled in?"}'
```

Identity arrives via `x-user-id` and `x-roles` headers. **In production this should be replaced with real JWT middleware** — the header-based approach is for local development only.

Response shape:

```json
{
  "status": "ok",
  "text": "...the agent's reply...",
  "traceId": "a4f2b91c-3a3b-4d6f-9c1d-...",
  "costUsd": 0.0064,
  "iterations": 2
}
```

Error states (`iteration_limit`, `budget_exceeded`, `error`) include a `reason` field instead of `text`.

### Evals

```bash
npm run eval
```

Loads `evals/cases.json`, instruments the tool registry to capture invocations, runs each case end-to-end against the real model, and asserts the expected behavior. Useful as a CI regression gate — see [`evals/README.md`](./evals/README.md) for case structure.

### Tests

```bash
npm test               # run once
npm run test:watch     # watch mode
```

34 tests across 5 files covering the policy engine, orchestrator (with a fake Anthropic client), tool registry, mock HCM client, and audit logger. See [`tests/README.md`](./tests/README.md) for the breakdown.

## Tools the agent can call

| Tool | Purpose | Destructive? |
| --- | --- | --- |
| `list_benefit_plans` | List available benefits plans for an employee | No |
| `enroll_in_benefit_plan` | Enroll an employee in a specific plan | **Yes** |
| `get_pto_balance` | Look up an employee's PTO accrual and usage | No |
| `request_time_off` | Submit a PTO request for manager approval | **Yes** |
| `list_pending_approvals` | List approval requests awaiting decision | No |
| `decide_approval` | Approve or reject a pending request | **Yes** |

All destructive tools are documented as such in their tool descriptions, and the system prompt instructs the agent to confirm with the user before invoking them.

## Notable design decisions

This section is the meat — the rationale behind the choices that distinguish this codebase from a typical demo.

### Why a centralized policy engine

The naive approach is to put authorization checks inside each tool handler. That works until you have 50 tools and three of them forget. Centralizing the gate has four benefits:

- **Forgetting becomes impossible.** A new tool inherits org-wide rules automatically.
- **Cross-cutting rules fit naturally.** "No enrollment outside the open window" applies to multiple tools but lives in *none* of them. The policy engine owns it.
- **Auditing is uniform.** Every denial is logged with a structured reason. No tool-specific log formats.
- **The LLM can recover.** When policy denies, we surface `POLICY_DENIED: <reason>` as the tool result. The model reads it and adapts the conversation.

### Why explicit cost & iteration budgets

LLM agents can loop. Models can hallucinate tool arguments that cause retries. A single bad session can cost $40+ without guards. The orchestrator estimates cost from token usage on every iteration, hard-stops past `maxCostUsd`, and caps iterations at `maxIterations`. Both are configurable per-deployment, and budget exhaustion is a graceful return value (`status: "budget_exceeded"`) — never a crash.

### Why an HCMClient interface, not a vendor SDK

The orchestrator never imports `@oracle/hcm-cloud` or `@workday/sdk`. It depends on `HCMClient`, an interface this repo satisfies with `MockHCMClient` for development. Production deployments wire in the real implementation. Three benefits:

- **The eval suite runs on a laptop in seconds** with deterministic in-memory state.
- **Vendor swaps don't ripple through agent code.** Migrating from Oracle HCM to Workday means writing a new `HCMClient`, nothing more.
- **Testing is trivial.** Want to test what the agent does when the HCM returns no plans? Inject a stub.

### Why both unit tests and evals

Unit tests verify code. Evals verify behavior. They answer different questions:

| Question | Where |
| --- | --- |
| Does the policy engine deny cross-employee access? | Unit test |
| Does the orchestrator hit the budget cap correctly? | Unit test |
| Does the agent decide to call `list_benefit_plans` when asked about benefits? | Eval |
| Does the agent stop when policy denies, instead of retrying? | Eval |
| Does the response mention the right plan IDs? | Eval |

Most candidates ship one or the other. This ships both, with the orchestrator tested via a fake Anthropic client (`tests/helpers/fake-anthropic.ts`) for determinism.

### Why an append-only audit log

Enterprise buyers don't ask "did your agent work" — they ask "can you prove who did what." Every tool invocation, every policy decision, every error is written as a JSONL line with `traceId`, `actor`, `type`, `payload`, and `timestamp`. The current implementation writes to a file; production should swap in QLDB, S3 Object Lock, or a signed Kafka stream so events cannot be retroactively edited.

### Why the orchestrator returns `AgentResult` instead of throwing

Errors that are *expected* (budget exhausted, iteration cap hit, policy denial) are not exceptions — they're outcomes. Returning them as values forces every caller to handle them explicitly and makes the audit trail richer. Real errors (network failures, malformed schemas) still throw.

## Tech stack

| Layer | Choice | Why |
| --- | --- | --- |
| Language | TypeScript | Strict types catch tool-schema mismatches at compile time |
| Runtime | Node.js 20+ | Native ES modules, modern fetch, broad enterprise support |
| LLM | Anthropic Claude (via SDK) | Tool-use API, abstracted behind one client for swappability |
| HTTP | Express | Boring, widely understood, easy to wrap with real middleware |
| Tests | Vitest | Fast, TypeScript-native, integrates cleanly with VS Code |
| Bundler | tsx (dev) / tsc (build) | Zero-config dev loop, standard TS compilation for prod |

## Documentation

| Doc | Purpose |
| --- | --- |
| [`README.md`](./README.md) | This file — overview, quickstart, design tradeoffs |
| [`ARCHITECTURE.md`](./ARCHITECTURE.md) | System architecture and request lifecycle |
| [`CONTRIBUTING.md`](./CONTRIBUTING.md) | Development setup and conventions |
| [`docs/api.md`](./docs/api.md) | HTTP API reference |
| [`docs/deployment.md`](./docs/deployment.md) | Production hardening guide |
| [`docs/adding-a-tool.md`](./docs/adding-a-tool.md) | How to add a new tool, end to end |
| [`docs/adding-a-policy-rule.md`](./docs/adding-a-policy-rule.md) | How to extend the policy engine |
| [`docs/adr/`](./docs/adr/) | Architecture Decision Records — the *why* behind the choices |
| [`tests/README.md`](./tests/README.md) | Test suite overview |
| [`evals/README.md`](./evals/README.md) | Eval harness docs |

## Production hardening checklist

This scaffold is designed to be extended. To take it to production:

- [ ] Replace `FileAuditLogger` with QLDB / S3 Object Lock / signed Kafka stream
- [ ] Replace `MockHCMClient` with the real Oracle HCM REST client
- [ ] Wire `authContext` to your real OAuth/JWT middleware
- [ ] Replace the placeholder `estimateCost` with a per-model pricing table loaded from config
- [ ] Add OpenTelemetry traces (the `trace()` helper is a stub)
- [ ] Add a vector store + RAG for company policy documents (currently inline in the system prompt)
- [ ] Add multi-tenant scoping (a `tenantId` flowing through `AgentContext`)
- [ ] Add retry logic with exponential backoff in the integration layer
- [ ] Add a circuit breaker for the LLM client
- [ ] Run the eval suite in CI as a regression gate
- [ ] Add structured logging (pino, winston) at the gateway layer
- [ ] Add prompt versioning so prompt changes are auditable
- [ ] Add request signing on the integration layer for non-repudiation

## Roadmap

Possible directions for further development:

- **Trace UI** — visualize a session message-by-message with policy decisions and tool calls inline. Highest-leverage demo for non-technical reviewers.
- **Multi-tenant scoping** — `tenantId` flowing through context, isolation tests, per-tenant policy rules.
- **Replay-from-audit** — turn real production traces into eval cases. Few systems do this.
- **Real Workday / ServiceNow connectors** — second and third `HCMClient` implementations to demonstrate the interface boundary.
- **Streaming responses** — Server-Sent Events from the `/chat` endpoint for token-by-token UI.
- **Cost dashboard** — aggregate audit log into per-user, per-day, per-tool spend.

## License

MIT — see [`LICENSE`](./LICENSE).
