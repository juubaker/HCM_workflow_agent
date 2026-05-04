# Evals

Lightweight harness for measuring agent behavior on real workflows. Unit tests verify code; evals verify behavior.

## Run

```bash
npm run eval
```

The runner iterates `cases.json`, instruments the tool registry to capture invocations, runs the orchestrator end-to-end against the LLM, and asserts each case.

## Case shape

```json
{
  "id": "unique-id",
  "input": "user message to the agent",
  "context": { "userId": "emp-001", "roles": ["employee"] },
  "expectations": {
    "must_call": ["tool_name"],
    "must_not_call": ["other_tool"],
    "must_contain": ["substring"]
  }
}
```

## What's measured

- **Tool selection** — did the agent call the right tools?
- **Policy compliance** — did blocked actions actually get blocked?
- **Response quality** — did the response contain expected content?
- **Cost & latency** — printed per-case for budget tracking.

## Production extension

This is intentionally minimal so it runs on a laptop in seconds. For production-grade regression testing, integrate with a tool like Langfuse or Braintrust to track results over time and gate CI on a regression threshold.
