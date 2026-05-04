# Tests

Vitest-based unit tests covering every component below the orchestrator, plus orchestrator tests with a fake Anthropic client.

## Run

```bash
npm test              # run once
npm run test:watch    # watch mode
```

In VS Code: open the **Testing** panel (flask icon) and the Vitest extension auto-discovers everything. Click ▶ next to a test to run it; click 🐞 to debug with breakpoints.

## What's covered

| File | What it tests |
| --- | --- |
| `policy.test.ts` | Self-service scope, approval authority, enrollment window, rule composition |
| `tools/registry.test.ts` | Registration, dispatch, schema export, error paths |
| `integrations/mock-hcm.test.ts` | Every method on the mock HCM client |
| `observability/audit.test.ts` | File audit logger writes valid JSONL |
| `orchestrator.test.ts` | End-to-end agent loop with fake LLM: tool dispatch, policy denial recovery, handler errors, iteration cap, cost cap |

## Why a fake Anthropic client

`tests/helpers/fake-anthropic.ts` is a queue-based test double that implements `messages.create()`. Tests enqueue canned responses; the orchestrator dequeues them as it loops. This makes the loop fully deterministic and zero-cost — there's no network call, no model variance, no API key needed.

The eval suite (under `evals/`) is the complementary other half: it exercises the *real* model against the same code paths to test behavioral characteristics that unit tests can't.

## Layout

Tests mirror the `src/` tree:

```
tests/
├── helpers/
│   └── fake-anthropic.ts
├── integrations/
│   └── mock-hcm.test.ts
├── observability/
│   └── audit.test.ts
├── tools/
│   └── registry.test.ts
├── orchestrator.test.ts
├── policy.test.ts
└── README.md
```
