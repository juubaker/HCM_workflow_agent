# Deployment

This document covers what changes between local development and a production deployment. The scaffold is designed to ship — the core architecture is correct — but several pieces are explicitly stubbed and must be replaced.

## Production-hardening checklist

Six things are non-negotiable before this serves real users:

| Item | Why | Where to change |
| --- | --- | --- |
| Real auth middleware | Header-based identity is impersonation-by-design | `src/server.ts` `authContext()` |
| Real HCM client | `MockHCMClient` is in-memory and deterministic | `src/integrations/` + wiring in entry points |
| Immutable audit store | `FileAuditLogger` writes to a local file that anyone with shell access can edit | `src/observability/audit.ts` |
| Real cost estimation | `estimateCost()` uses placeholder per-million rates | `src/orchestrator.ts` |
| Secrets management | `.env` files don't belong in production | Whatever your cloud uses (AWS Secrets Manager, GCP Secret Manager, Vault) |
| Eval suite as CI gate | Prompt regressions silently degrade quality otherwise | CI config |

## Replacing each stub

### Auth middleware

`authContext()` in `src/server.ts` reads identity from request headers. This is fine for local development — never for production. Replace with real middleware that:

1. Validates a JWT (or session, or mTLS client cert) on every request.
2. Pulls user identity and roles from the validated token, not from request headers.
3. Returns 401 when validation fails.

The downstream code is unchanged — the `AgentContext` shape is the same regardless of how it's constructed.

### HCM client

`MockHCMClient` implements `HCMClient` with hardcoded data. Real deployments need a real implementation. Two patterns work:

**Direct vendor SDK.** Install the SDK (`@oracle/hcm-cloud`, `@workday/sdk`, etc.) and implement the interface against it. Live with the SDK's auth, retry, and rate-limit behavior.

**Service-to-service via internal HCM service.** If your company already has a service that talks to HCM, point the implementation at that service's REST/gRPC API. Often easier than fighting vendor SDK quirks.

Either way: the agent code does not change. Wire the new implementation in `src/index.ts` and `src/server.ts`:

```ts
const hcm = new RealHCMClient({ apiKey: process.env.HCM_API_KEY, ... });
```

### Audit store

`FileAuditLogger` writes JSONL to a file. That's fine for development, useless for compliance. Production options, in increasing order of guarantee:

- **AWS QLDB** — append-only ledger with cryptographic verification. Built for this use case.
- **AWS S3 with Object Lock** — write-once-read-many semantics enforced at the storage layer.
- **Signed Kafka stream** — events written with HMAC; downstream consumers verify before trusting.

All three implement the same `AuditLogger` interface. Swap is a one-line wiring change.

The audit log captures structured events (`agent.start`, `tool.invoked`, `policy.denied`, `agent.end`, etc.) with a `traceId`, `actor`, and `payload`. Build read-side dashboards on top of whichever storage you choose.

### Cost estimation

`estimateCost()` in `src/orchestrator.ts` uses placeholder rates ($3 input / $15 output per million tokens). Production should:

1. Maintain a per-model pricing table loaded from configuration, updated when Anthropic adjusts pricing.
2. Account for prompt caching discounts if used.
3. Optionally include downstream API costs if the integration layer charges per call.

For the moment, the estimate is conservative enough to keep budgets functional, but it's not accurate enough for billing.

### Secrets management

`.env` files belong on developer laptops, not in production. Your cloud has a service for this:

- **AWS** — Secrets Manager or Parameter Store
- **GCP** — Secret Manager
- **Azure** — Key Vault
- **Self-hosted** — HashiCorp Vault

The Anthropic API key, real HCM credentials, signing keys for the audit store, and any other secrets get loaded from the secrets service at startup, not from environment variables baked into a container image.

### Eval suite as CI gate

`npm run eval` runs the behavioral test suite against the real model. Wire it into CI on a schedule that balances cost and signal:

- **On every PR** — too expensive for most teams unless the suite is small (under 20 cases).
- **Nightly on main** — good baseline; catches regressions within 24 hours.
- **Pre-deploy** — strongest gate; blocks the release if behavior regressed.

Pin the model version explicitly (`AGENT_MODEL` environment variable) so eval results are comparable across runs.

## Suggested deployment topologies

### Stateless containers behind a load balancer

The simplest topology, and what the scaffold is built for:

```
clients → load balancer → N containers running `npm run server`
                                    ↓
                          HCM service / audit store
```

- Each container is stateless. Conversation history is sent client-side and threaded back through the `history` field.
- Auto-scale on CPU (LLM calls are I/O-bound; CPU is mostly serializing JSON).
- Each container needs the API key, HCM credentials, and audit store credentials at startup.

### Per-tenant isolation

For multi-tenant SaaS (which this project doesn't yet support), the architectural decision is between:

- **Shared infrastructure with `tenantId` flowing through `AgentContext`** — cheaper, shares load balancers and containers, but a bug in policy is a cross-tenant data leak.
- **Per-tenant containers** — more expensive but harder to leak across tenants. Practical for small numbers of large tenants.

This is on the [roadmap](../README.md#roadmap) but not implemented.

## Observability

Three signals worth wiring up before users arrive:

- **Logs** — Replace `console.log` calls in `index.ts` and `server.ts` with structured logging (pino, winston). Include `traceId` on every line.
- **Metrics** — Implement `trace()` in `src/observability/metrics.ts` against OpenTelemetry. Useful baseline metrics: tool call latency by tool name, LLM call latency, policy denial rate, iteration distribution, cost per session.
- **Alerts** — alert on: budget exhaustion rate above baseline, iteration limit hits above baseline, error rate above baseline, p99 latency.

The scaffold's audit log is a structured event stream that doubles as the data source for a tracing UI if you build one.

## Cost controls

Beyond the in-orchestrator budget caps, two operational levers worth having:

- **Per-user daily limits** — tracked outside the orchestrator, enforced at the gateway. Stops a single bad actor from running up six figures.
- **Model fallback** — if `AGENT_MAX_COST_USD` is exceeded, can the request be retried with a cheaper model? The `model` field in `OrchestratorOptions` is configurable per-call, so this is straightforward.

## What this guide doesn't cover

- Specific cloud provider deployment (Kubernetes manifests, ECS task defs, Cloud Run configs) — too vendor-specific.
- Database migrations, since the agent is stateless.
- Frontend integration — this scaffold is the backend; the web UI / Slack bot is a separate concern.

For each of those, the agent treats them as configuration. The architecture is the same regardless of where it runs.
