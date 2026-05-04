# 0004 — Evals alongside unit tests

## Status

Accepted

## Context

LLM-driven systems have two distinct failure modes that need different testing strategies:

- **Code bugs.** "The orchestrator drops a tool result block when stop_reason is unexpected." Deterministic, reproducible from inputs alone.
- **Behavioral bugs.** "The agent decided to retry after a policy denial instead of explaining the issue." Non-deterministic, depends on the model's behavior given a prompt.

Unit tests catch the first. They do nothing for the second — you can't unit-test "did the model decide correctly?" with a unit test framework, because the test isn't of code.

A common but inadequate pattern is to skip behavioral testing entirely and ship on vibes. This works until a prompt change silently regresses a previously-working query.

A better pattern: maintain a separate suite of behavioral evals — assertion-based test cases run against the real model — alongside the unit tests.

## Decision

Two test suites, each scoped to its strength:

**Unit tests** (`tests/`)
- Vitest, run via `npm test`
- Use a fake Anthropic client (`tests/helpers/fake-anthropic.ts`) that returns canned responses
- Fully deterministic, run in seconds, no API key needed
- Cover: policy engine, tool registry, orchestrator loop mechanics, integrations, audit logger

**Behavioral evals** (`evals/`)
- Custom runner in `evals/runner.ts`, run via `npm run eval`
- Use the real model, the real orchestrator, and the mock HCM client
- Cases in `evals/cases.json` declare expectations: `must_call`, `must_not_call`, `must_contain`
- Cover: tool selection, policy enforcement under realistic prompts, response content

The two suites share no code paths — that's intentional. They're testing different things.

## Consequences

**Easier:**

- Code regressions caught in CI on every commit, with no API costs.
- Prompt regressions caught by evals before deploy.
- Each suite stays simple: unit tests don't need to fake LLM behavior, evals don't need to mock infrastructure.
- The fake Anthropic client lets unit tests cover orchestrator paths (budget exhaustion, iteration cap, error recovery) deterministically.

**Harder:**

- Eval suite is slow (model latency) and costs money (API tokens). Can't run on every commit. Recommended cadence: PR review and nightly.
- Eval assertions are coarse — substring match, tool-call presence. They catch egregious regressions but miss subtle ones. A future improvement is LLM-as-judge for response-quality assertions, but that adds cost and another source of variance.
- Two suites means two CI configurations and two failure modes for engineers to triage. The workflow needs to make clear which one failed.
- When a behavior is testable both ways, contributors must choose. The rule of thumb: if the behavior is deterministic given inputs, unit-test it. If the behavior depends on the model's reasoning, eval it.
