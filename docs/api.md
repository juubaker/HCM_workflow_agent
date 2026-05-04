# API Reference

The HTTP server (`npm run server`) exposes a small REST surface for invoking the agent over the network. This is what a web UI, a Slack bot, or a backend service would hit.

Server defaults to port 3000; configure via the `PORT` environment variable.

## `GET /healthz`

Liveness probe. Returns 200 with a small JSON body. Use for load-balancer health checks.

**Response (200):**

```json
{ "ok": true }
```

## `POST /chat`

Run the agent against a user message.

**Headers:**

| Header | Required | Description |
| --- | --- | --- |
| `Content-Type: application/json` | yes | |
| `x-user-id` | no, defaults to `emp-001` | Caller's employee ID. Used for policy and audit. |
| `x-roles` | no, defaults to `employee` | Comma-separated list of caller roles. |

> **Important:** Header-based identity is for development only. In production this endpoint must sit behind real auth middleware (JWT, OAuth, mTLS) that populates the same fields from a verified token. Trusting `x-user-id` from a client is impersonation-by-design.

**Request body:**

```json
{
  "message": "What's my PTO balance?",
  "history": []
}
```

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `message` | string | yes | The user's input for this turn. |
| `history` | `MessageParam[]` | no | Prior conversation turns. Pass back the `messages` field from a previous response to maintain context across turns. |

**Successful response (200):**

```json
{
  "status": "ok",
  "text": "You currently have 88 hours of PTO accrued, with 24 used and 0 pending.",
  "traceId": "a4f2b91c-3a3b-4d6f-9c1d-...",
  "costUsd": 0.0064,
  "iterations": 2,
  "messages": [ /* full conversation including this turn */ ]
}
```

**Status values:**

| `status` | Meaning |
| --- | --- |
| `ok` | The agent finished and produced a `text` response. |
| `iteration_limit` | The agent hit `AGENT_MAX_ITERATIONS` without finishing. `reason` explains. |
| `budget_exceeded` | The agent hit `AGENT_MAX_COST_USD`. `reason` includes actual spend. |
| `error` | An unexpected stop reason from the LLM. `reason` explains. |

**Error responses:**

- `400 Bad Request` — `message` field missing or not a string.
- `500 Internal Server Error` — uncaught exception; response includes `{ "error": "..." }` with the message.

## Multi-turn example

Request 1:

```bash
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -H "x-user-id: emp-001" \
  -H "x-roles: employee,manager" \
  -d '{"message": "What benefits am I enrolled in?"}'
```

Response 1 (truncated):

```json
{
  "status": "ok",
  "text": "You're currently enrolled in BlueShield PPO and Delta Dental Basic.",
  "messages": [ /* ... */ ]
}
```

Request 2 — pass the previous `messages` back as `history`:

```bash
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -H "x-user-id: emp-001" \
  -H "x-roles: employee,manager" \
  -d '{"message": "Switch me to the HMO plan", "history": [/* messages from response 1 */]}'
```

The agent picks up where the prior turn left off — it knows "the HMO plan" refers to BlueShield HMO without re-fetching the plan list.

## What's intentionally not here

A few endpoints a production deployment will need but this scaffold doesn't:

- `POST /chat/stream` — Server-Sent Events for token-by-token responses. The orchestrator's response shape is set up for this; the streaming wrapper is the missing piece.
- `GET /audit/:traceId` — read back the audit trail for a session. The data is there in the JSONL file, but no read API yet.
- `GET /metrics` — Prometheus-compatible metrics. The `trace()` helper in `observability/metrics.ts` is a stub; production wires it to OpenTelemetry.

See [`deployment.md`](./deployment.md) for the full production-hardening list.
