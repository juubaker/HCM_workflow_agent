# Adding a new policy rule

Policy rules gate every tool call. Adding one is a two-line code change plus tests. This walkthrough adds a fictional `enforceSensitiveDataApproval` rule — block any read of compensation data unless the caller has explicit `comp_view` authorization.

## 1. Define the rule

Policy rules live in `src/policy/rules.ts`. A rule is a function matching the `PolicyRule` type:

```ts
type PolicyRule = (req: PolicyCheckInput) => Promise<PolicyResult> | PolicyResult;
```

`PolicyCheckInput` includes the tool name, its input, and the caller's `AgentContext`. Return `{ allowed: true }` to pass; `{ allowed: false, reason: "..." }` to block.

```ts
// src/policy/rules.ts

/**
 * Compensation tools require explicit comp_view authorization. This rule
 * fires only on tools whose name starts with "comp_". Non-matching tools
 * pass through.
 */
export const enforceSensitiveDataApproval: PolicyRule = ({ tool, context }) => {
  if (!tool.startsWith("comp_")) return { allowed: true };
  if (context.roles.includes("comp_view") || context.roles.includes("hr_admin")) {
    return { allowed: true };
  }
  return {
    allowed: false,
    reason: "Compensation data access requires comp_view or hr_admin authorization",
  };
};
```

Three patterns worth following:

- **Scope the rule by tool name.** A rule that fires on every call adds latency and noise. The first line checks whether this rule is even relevant.
- **Default to allow.** If your rule's preconditions don't match, return `{ allowed: true }`. The engine combines rules with logical AND — first deny wins, but no-opinion rules let other rules speak.
- **Explain in the reason field.** The reason text is surfaced to the LLM as the tool result, which means it's surfaced to the user. Make it actionable: "you'd need X authorization" is better than "denied."

## 2. Register the rule

Add it to the engine chain in both entry points — `src/index.ts` and `src/server.ts`:

```ts
const policy = new PolicyEngine()
  .use(enforceSelfServiceScope)
  .use(enforceApprovalAuthority)
  .use(enforceSensitiveDataApproval)              // ← new
  .use(enforceEnrollmentWindow(start, end));
```

Order matters when rules overlap. Currently rules are independent — they fire on different tool sets — so ordering is by author preference. If two rules might both apply to the same tool, place the more restrictive one first.

## 3. Parameterize when the rule has configuration

If your rule needs configuration (a date range, a feature flag, a rate limit), use the factory pattern. `enforceEnrollmentWindow` is the existing example:

```ts
export function enforceEnrollmentWindow(start: Date, end: Date): PolicyRule {
  return ({ tool }) => {
    if (tool !== "enroll_in_benefit_plan") return { allowed: true };
    const now = new Date();
    if (now < start || now > end) {
      return { allowed: false, reason: `Window closed (${start.toISOString().slice(0, 10)} to ${end.toISOString().slice(0, 10)})` };
    }
    return { allowed: true };
  };
}
```

The function takes the configuration and *returns* the rule. The engine's `.use()` accepts both styles — bare functions and factory-produced functions — interchangeably.

## 4. Write tests

Add to `tests/policy.test.ts`:

```ts
describe("PolicyEngine — sensitive data approval", () => {
  it("blocks comp_ tools for callers without comp_view", async () => {
    const engine = new PolicyEngine().use(enforceSensitiveDataApproval);
    const result = await engine.check({
      tool: "comp_view_salary",
      input: { employeeId: "emp-001" },
      context: { userId: "emp-001", roles: ["employee"] },
    });
    expect(result.allowed).toBe(false);
  });

  it("permits comp_view holders", async () => {
    const engine = new PolicyEngine().use(enforceSensitiveDataApproval);
    const result = await engine.check({
      tool: "comp_view_salary",
      input: { employeeId: "emp-001" },
      context: { userId: "emp-001", roles: ["employee", "comp_view"] },
    });
    expect(result.allowed).toBe(true);
  });

  it("ignores non-comp tools", async () => {
    const engine = new PolicyEngine().use(enforceSensitiveDataApproval);
    const result = await engine.check({
      tool: "get_pto_balance",
      input: { employeeId: "emp-001" },
      context: { userId: "emp-001", roles: ["employee"] },
    });
    expect(result.allowed).toBe(true);
  });
});
```

Three tests is the minimum for a useful rule: one passing case, one failing case, one no-op case.

## 5. Consider behavioral evals

Policy rules also benefit from behavioral evals. If your rule should change the agent's response (not just block a tool), add an eval case to `evals/cases.json` checking the user-visible behavior:

```json
{
  "id": "comp-denial",
  "input": "What's emp-002's salary?",
  "context": { "userId": "emp-001", "roles": ["employee"] },
  "expectations": {
    "must_not_call": ["comp_view_salary"],
    "must_contain": ["authorization"]
  }
}
```

That verifies both the policy block *and* that the model surfaces the denial reason cleanly to the user.

## When to write a new rule vs. extending an existing one

Extend an existing rule when:

- The new condition is a tightening of the existing rule's intent (e.g., adding a new manager-equivalent role to `enforceSelfServiceScope`)

Write a new rule when:

- The condition is independent (e.g., time windows, audit-mandated approvals)
- The condition affects a different set of tools

Independent rules are easier to reason about and easier to remove. The cost of an extra rule in the chain is negligible.
