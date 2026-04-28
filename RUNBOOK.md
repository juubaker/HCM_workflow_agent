# Runbook

Instructions for running and testing the HCM Workflow Agent.

## Prerequisites

- Node.js 20+
- An Anthropic API key

## Setup

```bash
npm install
cp .env.example .env
```

Edit `.env` and set your API key:

```
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

The other `.env` values have sensible defaults and can be left as-is for local development.

## Running

### Interactive CLI

Starts a conversation loop where you can interact with the agent as an employee/manager:

```bash
npm run dev
```

### HTTP Server

Exposes a REST API on `http://localhost:3000` (or the `PORT` you set in `.env`):

```bash
npm run server
```

Send requests:

```bash
curl -X POST http://localhost:3000/agent \
  -H "Content-Type: application/json" \
  -d '{"message": "What PTO do I have?", "userId": "emp-001", "roles": ["employee"]}'
```

### Production build

```bash
npm run build       # compiles TypeScript to dist/
npm start           # runs the compiled output
```

## Configuration

| Variable               | Default           | Description                                  |
| ---------------------- | ----------------- | -------------------------------------------- |
| `ANTHROPIC_API_KEY`    | —                 | Required. Your Anthropic API key.            |
| `AGENT_MODEL`          | `claude-opus-4-7` | Claude model to use.                         |
| `AGENT_MAX_ITERATIONS` | `10`              | Max agent loop turns per request.            |
| `AGENT_MAX_COST_USD`   | `1.00`            | Per-request cost budget in USD.              |
| `AGENT_TRACE`          | `0`               | Set to `1` to log every tool call to stdout. |
| `AUDIT_PATH`           | `./audit.log`     | Path for the append-only JSONL audit log.    |
| `PORT`                 | `3000`            | HTTP server port.                            |

## Testing

### Unit tests

Run once:

```bash
npm test
```

Watch mode (re-runs on file save):

```bash
npm run test:watch
```

No API key required — unit tests use a fake Anthropic client (`tests/helpers/fake-anthropic.ts`) that replays canned responses deterministically.

| Test file                             | What it covers                                                                         |
| ------------------------------------- | -------------------------------------------------------------------------------------- |
| `tests/policy.test.ts`                | Policy engine rules: self-service scope, approval authority, enrollment windows        |
| `tests/tools/registry.test.ts`        | Tool registration, dispatch, schema export, error paths                                |
| `tests/integrations/mock-hcm.test.ts` | Every method on the mock HCM client                                                    |
| `tests/observability/audit.test.ts`   | Audit logger writes valid JSONL                                                        |
| `tests/orchestrator.test.ts`          | Full agent loop: tool dispatch, policy denial, handler errors, iteration cap, cost cap |

### Behavioral evals

Evals run the real model end-to-end against a set of cases defined in `evals/cases.json`. They verify tool selection, policy compliance, and response quality — things unit tests cannot catch.

**Requires a valid `ANTHROPIC_API_KEY`** and will incur API costs.

```bash
npm run eval
```

Each case reports pass/fail, cost, and latency. See `evals/README.md` for how to add cases or extend the harness.
