# 0003 — HCMClient as interface, not SDK dependency

## Status

Accepted

## Context

The agent must integrate with enterprise HCM systems: Oracle HCM, Workday, ServiceNow, and others. Each vendor ships an SDK with its own auth flow, error model, naming conventions, and data shapes. The naive approach is to import the vendor SDK directly into the agent code:

```ts
import { OracleHCMClient } from "@oracle/hcm-cloud";

const hcm = new OracleHCMClient({ ... });
async function listBenefits(empId: string) {
  return hcm.benefits.list({ employeeId: empId });
}
```

This works on day one. It causes problems on day 100:

- **Vendor lock-in** is implicit. A migration from Oracle to Workday touches every file that references the SDK.
- **Tests need the SDK.** Either you pay for a real sandbox or you mock the SDK shape — both are expensive.
- **Eval suite cost.** Behavioral evals need deterministic state. Real vendor sandboxes don't give you that.
- **Multi-vendor support requires duplication.** Each new vendor needs a parallel code path through every tool.

## Decision

Define a narrow `HCMClient` interface in `src/integrations/`:

```ts
export interface HCMClient {
  listBenefitPlans(employeeId: string): Promise<BenefitPlan[]>;
  enrollInPlan(employeeId: string, planId: string, dependents: string[]): Promise<...>;
  // ...
}
```

Agent code (tool handlers, orchestrator) depends on this interface only. Two implementations live alongside:

- `MockHCMClient` for development, tests, and evals — deterministic in-memory state
- (Future) `OracleHCMClient`, `WorkdayClient`, etc. — implement the same interface, wire the vendor SDK inside

The orchestrator never imports vendor SDKs. Only the integration implementation does.

## Consequences

**Easier:**

- Vendor swaps are local — write a new `HCMClient` implementation, wire it in `index.ts`, ship.
- Eval suite runs on a laptop in seconds with deterministic mock state. No sandbox tenants.
- Unit tests inject stubs trivially; no SDK mocking required.
- Multi-vendor support is N implementations in `src/integrations/`, not N forks of the agent.
- Interface boundary forces the team to articulate the *minimum* operations needed, rather than letting vendor SDK shapes leak across the codebase.

**Harder:**

- Interface design is a commitment. Adding methods means updating every implementation. Breaking changes require careful migration.
- Real vendor APIs have edge cases (pagination styles, retry semantics, partial failures) the interface might not capture cleanly. Expect the interface to evolve as real implementations are built.
- The interface is in the integrations directory rather than a shared types package. If the agent grows into a multi-package monorepo, the interface should move to a shared location to prevent circular dependencies.
