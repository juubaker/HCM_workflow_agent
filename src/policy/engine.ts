import type { AgentContext } from "../types.js";

export interface PolicyCheckInput {
  tool: string;
  input: Record<string, unknown>;
  context: AgentContext;
}

export type PolicyResult =
  | { allowed: true }
  | { allowed: false; reason: string };

export type PolicyRule = (
  req: PolicyCheckInput
) => Promise<PolicyResult> | PolicyResult;

export class PolicyDenial extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "PolicyDenial";
  }
}

/**
 * Chain of policy rules. First rule to deny wins. Empty engine allows all.
 * Add rules with .use(); they run in registration order.
 */
export class PolicyEngine {
  private readonly rules: PolicyRule[] = [];

  use(rule: PolicyRule): this {
    this.rules.push(rule);
    return this;
  }

  async check(req: PolicyCheckInput): Promise<PolicyResult> {
    for (const rule of this.rules) {
      const result = await rule(req);
      if (!result.allowed) return result;
    }
    return { allowed: true };
  }
}
