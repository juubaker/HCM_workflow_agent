# Adding a new tool

This walkthrough adds a fictional `lookup_employee_directory` tool — given an employee ID, return the employee's name, department, and manager. It touches every layer the agent has, so it's a good template for any new tool.

## 1. Extend the integration interface

The agent never calls vendor SDKs directly. Add the method to `HCMClient` first.

```ts
// src/integrations/mock-hcm.ts

export interface DirectoryEntry {
  employeeId: string;
  name: string;
  department: string;
  managerId: string | null;
}

export interface HCMClient {
  // ...existing methods...
  lookupDirectory(employeeId: string): Promise<DirectoryEntry | null>;
}
```

Implement it in `MockHCMClient`:

```ts
async lookupDirectory(employeeId: string): Promise<DirectoryEntry | null> {
  const directory: Record<string, DirectoryEntry> = {
    "emp-001": { employeeId: "emp-001", name: "Alice Chen",  department: "Engineering", managerId: null },
    "emp-002": { employeeId: "emp-002", name: "Bob Patel",   department: "Engineering", managerId: "emp-001" },
  };
  return directory[employeeId] ?? null;
}
```

## 2. Define the tool handler

Tool handlers live in `src/tools/`. Group related tools in one file (e.g., `directory.ts`) to keep them discoverable.

```ts
// src/tools/directory.ts

import type { ToolHandler } from "./registry.js";
import type { HCMClient } from "../integrations/mock-hcm.js";

interface LookupInput {
  employeeId: string;
}

export function directoryTools(hcm: HCMClient): ToolHandler[] {
  return [
    {
      name: "lookup_employee_directory",
      description:
        "Look up an employee's name, department, and manager by their employee ID.",
      inputSchema: {
        type: "object",
        properties: {
          employeeId: { type: "string", description: "Employee identifier" },
        },
        required: ["employeeId"],
      },
      handler: async (input, _ctx) => {
        const i = input as LookupInput;
        return hcm.lookupDirectory(i.employeeId);
      },
    },
  ];
}
```

The factory pattern (function that takes `hcm` and returns handlers) keeps the integration dependency explicit and makes testing trivial.

## 3. Register it

Add the new tool to the registry in both entry points — `src/index.ts` (CLI) and `src/server.ts` (HTTP server).

```ts
import { directoryTools } from "./tools/directory.js";

for (const tool of [
  ...benefitsTools(hcm),
  ...timeoffTools(hcm),
  ...approvalTools(hcm),
  ...directoryTools(hcm),
]) {
  tools.register(tool);
}
```

## 4. Consider policy

Does the tool need new policy rules?

- **Cross-employee access.** `enforceSelfServiceScope` already covers this — it triggers on any tool with `employeeId` in the input. Non-managers will be blocked from looking up other employees automatically.
- **New rule needed.** If your tool introduces a new authorization concern (e.g., "only HR can look up salary data"), add a rule. See [`adding-a-policy-rule.md`](./adding-a-policy-rule.md).

For our directory lookup, no new rule is needed.

## 5. Write a unit test

Mirror the source path: `src/tools/directory.ts` → `tests/tools/directory.test.ts`.

```ts
import { describe, it, expect } from "vitest";
import { directoryTools } from "../../src/tools/directory.js";
import { MockHCMClient } from "../../src/integrations/mock-hcm.js";

describe("directoryTools", () => {
  it("returns a directory entry for a known employee", async () => {
    const hcm = new MockHCMClient();
    const [tool] = directoryTools(hcm);
    const result = await tool.handler(
      { employeeId: "emp-001" },
      { userId: "emp-001", roles: ["employee"] }
    );
    expect(result).toMatchObject({ name: "Alice Chen" });
  });

  it("returns null for an unknown employee", async () => {
    const hcm = new MockHCMClient();
    const [tool] = directoryTools(hcm);
    const result = await tool.handler(
      { employeeId: "emp-ghost" },
      { userId: "emp-001", roles: ["employee"] }
    );
    expect(result).toBeNull();
  });
});
```

## 6. Add a behavioral eval

Behavioral evals catch regressions where the *code* is correct but the *model* stops choosing the right tool. Add a case to `evals/cases.json`:

```json
{
  "id": "directory-lookup",
  "input": "Who is my manager?",
  "context": { "userId": "emp-002", "roles": ["employee"] },
  "expectations": {
    "must_call": ["lookup_employee_directory"],
    "must_contain": ["Alice"]
  }
}
```

Run `npm run eval` to verify the model picks up the new tool.

## 7. Update documentation

Two places worth touching:

- **README.md** — the tools table in the *Tools the agent can call* section
- **ARCHITECTURE.md** — only if the new tool changes the system's shape (it usually doesn't)

That's the full path for a new tool: interface → handler → registration → policy review → unit test → eval → docs. The same pattern handles every tool the agent will ever need.
