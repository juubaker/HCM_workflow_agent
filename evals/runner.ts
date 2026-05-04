import Anthropic from "@anthropic-ai/sdk";
import fs from "node:fs/promises";
import { config, assertConfig } from "../src/config.js";
import { Orchestrator } from "../src/orchestrator.js";
import { ToolRegistry } from "../src/tools/registry.js";
import { benefitsTools } from "../src/tools/benefits.js";
import { timeoffTools } from "../src/tools/timeoff.js";
import { approvalTools } from "../src/tools/approvals.js";
import { PolicyEngine } from "../src/policy/engine.js";
import {
  enforceSelfServiceScope,
  enforceApprovalAuthority,
} from "../src/policy/rules.js";
import { MockHCMClient } from "../src/integrations/mock-hcm.js";
import { ConsoleAuditLogger } from "../src/observability/audit.js";

interface EvalCase {
  id: string;
  input: string;
  context: { userId: string; roles: string[] };
  expectations: {
    must_call?: string[];
    must_not_call?: string[];
    must_contain?: string[];
  };
}

async function run(): Promise<void> {
  assertConfig();

  const cases: EvalCase[] = JSON.parse(
    await fs.readFile("./evals/cases.json", "utf8")
  );
  const client = new Anthropic({ apiKey: config.anthropicApiKey });

  let passed = 0;
  let failed = 0;
  const start = Date.now();

  for (const c of cases) {
    const calledTools: string[] = [];
    const hcm = new MockHCMClient();
    const tools = new ToolRegistry();

    // Wrap each tool so the eval can observe what got called.
    for (const t of [
      ...benefitsTools(hcm),
      ...timeoffTools(hcm),
      ...approvalTools(hcm),
    ]) {
      const original = t.handler;
      t.handler = async (input, ctx) => {
        calledTools.push(t.name);
        return original(input, ctx);
      };
      tools.register(t);
    }

    const policy = new PolicyEngine()
      .use(enforceSelfServiceScope)
      .use(enforceApprovalAuthority);
    const audit = new ConsoleAuditLogger();

    const orchestrator = new Orchestrator({
      client,
      tools,
      policy,
      audit,
      model: config.model,
      maxIterations: 6,
    });

    const result = await orchestrator.run(c.input, c.context);

    const failures: string[] = [];
    for (const t of c.expectations.must_call ?? []) {
      if (!calledTools.includes(t)) failures.push(`expected to call ${t}`);
    }
    for (const t of c.expectations.must_not_call ?? []) {
      if (calledTools.includes(t)) failures.push(`should not have called ${t}`);
    }
    for (const phrase of c.expectations.must_contain ?? []) {
      if (!result.text?.toLowerCase().includes(phrase.toLowerCase())) {
        failures.push(`response missing "${phrase}"`);
      }
    }

    if (failures.length === 0) {
      passed++;
      console.log(
        `pass  ${c.id}  (${result.iterations} iter, $${result.costUsd.toFixed(4)})`
      );
    } else {
      failed++;
      console.log(`FAIL  ${c.id}`);
      for (const f of failures) console.log(`        ${f}`);
    }
  }

  const duration = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`\n${passed}/${passed + failed} passed in ${duration}s`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
