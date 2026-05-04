# 0001 — Policy engine as central gate

## Status

Accepted

## Context

Authorization and compliance for an enterprise agent could be implemented two ways:

1. **Inline in each tool handler.** Every handler opens with checks for the caller's roles, the target identity, applicable time windows, and so on, before doing its real work.
2. **Centralized in a policy engine that gates dispatch.** Tool handlers don't see the request until policy has approved it.

Option 1 is the path of least resistance — it works for two or three tools. The agent in this project has six tools today and is designed to grow to fifty in production. At that size, three things go wrong with inline checks:

- **Forgetting becomes the default failure mode.** New tools ship without checks because the author didn't think about it. Auditors find the gap; engineering scrambles.
- **Cross-cutting rules don't fit anywhere.** "No enrollment outside the open window" applies to multiple tools and lives in *none* of them. Inline, it gets duplicated and drifts out of sync.
- **Audit logs become heterogeneous.** Each tool logs denials its own way. There's no single place to ask "who got denied what, and why?"

## Decision

A `PolicyEngine` class runs *before* every tool dispatch in the orchestrator loop. Composable rules — plain functions matching `PolicyRule` — are added via `.use()`. First-deny-wins. Policy denials become tool results with content `POLICY_DENIED: <reason>`, surfaced back to the LLM as recoverable errors so it can adapt the conversation.

```ts
const policy = new PolicyEngine()
  .use(enforceSelfServiceScope)
  .use(enforceApprovalAuthority)
  .use(enforceEnrollmentWindow(start, end));
```

Inside `Orchestrator.run`:

```ts
const policyResult = await this.policy.check({ tool, input, context });
if (!policyResult.allowed) {
  // log, return POLICY_DENIED to the model, do not invoke the tool
}
```

## Consequences

**Easier:**

- New tools inherit org-wide rules automatically. The author writes the handler; the policy engine handles authorization.
- Cross-cutting rules (windows, scopes, role hierarchies) live in policy code, where they belong.
- Audit logs are uniform: every denial is a `policy.denied` event with a `reason`.
- The LLM can read the denial and adapt — "I can't access that record, you'd need to ask a manager" — instead of failing.

**Harder:**

- Policy rules need to be careful about which tools they affect. `enforceApprovalAuthority` checks `tool === "decide_approval"` to scope itself; future rules will need similar discipline.
- The engine is a critical path. If it's slow or buggy, every tool call suffers. The current implementation is in-memory and stateless, but a real deployment that hits a remote authorization service must handle failures explicitly.
- A new contributor might not realize the policy engine exists and try to add inline checks. Mitigated by `CONTRIBUTING.md` and code review.
