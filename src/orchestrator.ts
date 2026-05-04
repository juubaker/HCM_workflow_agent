import Anthropic from "@anthropic-ai/sdk";
import { randomUUID } from "node:crypto";
import { ToolRegistry } from "./tools/registry.js";
import { PolicyEngine } from "./policy/engine.js";
import { AuditLogger, AuditEvent } from "./observability/audit.js";
import { AgentContext, AgentResult } from "./types.js";
import { buildSystemPrompt } from "./prompts.js";

export interface OrchestratorOptions {
  client: Anthropic;
  tools: ToolRegistry;
  policy: PolicyEngine;
  audit: AuditLogger;
  model?: string;
  maxIterations?: number;
  maxCostUsd?: number;
}

/**
 * Runs the LLM tool-use loop with three production guarantees:
 *   1. Every tool call passes through the policy engine first.
 *   2. Cost and iteration counts are bounded.
 *   3. Every action and decision is recorded to the audit log.
 *
 * Events emitted: agent.start, llm.call, tool.invoked, tool.error,
 * policy.denied, agent.end, agent.budget_exceeded, agent.iteration_limit.
 * Each event carries durationMs where applicable for downstream metrics.
 */
export class Orchestrator {
  private readonly client: Anthropic;
  private readonly tools: ToolRegistry;
  private readonly policy: PolicyEngine;
  private readonly audit: AuditLogger;
  private readonly model: string;
  private readonly maxIterations: number;
  private readonly maxCostUsd: number;

  constructor(opts: OrchestratorOptions) {
    this.client = opts.client;
    this.tools = opts.tools;
    this.policy = opts.policy;
    this.audit = opts.audit;
    this.model = opts.model ?? "claude-opus-4-7";
    this.maxIterations = opts.maxIterations ?? 10;
    this.maxCostUsd = opts.maxCostUsd ?? 1.0;
  }

  async run(
    input: string,
    ctx: AgentContext,
    history: Anthropic.MessageParam[] = []
  ): Promise<AgentResult> {
    const traceId = ctx.traceId ?? randomUUID();
    const messages: Anthropic.MessageParam[] = [
      ...history,
      { role: "user", content: input },
    ];
    const toolDefs = this.tools.schemas();

    let totalCostUsd = 0;
    let iterations = 0;

    // Capture events for return value alongside the audit log.
    const events: AuditEvent[] = [];
    const emit = async (event: AuditEvent): Promise<void> => {
      const stamped = { ...event, timestamp: event.timestamp ?? new Date().toISOString() };
      events.push(stamped);
      await this.audit.log(stamped);
    };

    await emit({
      traceId,
      type: "agent.start",
      actor: ctx.userId,
      payload: { input, roles: ctx.roles, model: this.model },
    });

    while (iterations < this.maxIterations) {
      iterations++;

      const llmStart = Date.now();
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 4096,
        system: buildSystemPrompt(ctx),
        tools: toolDefs,
        messages,
      });
      const llmDuration = Date.now() - llmStart;
      const callCost = estimateCost(this.model, response.usage);
      totalCostUsd += callCost;

      await emit({
        traceId,
        type: "llm.call",
        payload: {
          iteration: iterations,
          model: this.model,
          inputTokens: response.usage?.input_tokens ?? 0,
          outputTokens: response.usage?.output_tokens ?? 0,
          costUsd: callCost,
          durationMs: llmDuration,
          stopReason: response.stop_reason,
        },
      });

      if (totalCostUsd > this.maxCostUsd) {
        await emit({
          traceId,
          type: "agent.budget_exceeded",
          payload: { totalCostUsd, limit: this.maxCostUsd },
        });
        return {
          status: "budget_exceeded",
          reason: `Spent $${totalCostUsd.toFixed(4)} exceeded $${this.maxCostUsd.toFixed(2)} cap`,
          traceId,
          costUsd: totalCostUsd,
          iterations,
          messages,
          events,
        };
      }

      messages.push({ role: "assistant", content: response.content });

      if (response.stop_reason === "end_turn") {
        const text = response.content
          .filter((b): b is Anthropic.TextBlock => b.type === "text")
          .map((b) => b.text)
          .join("");
        await emit({
          traceId,
          type: "agent.end",
          payload: { iterations, costUsd: totalCostUsd },
        });
        return {
          status: "ok",
          text,
          traceId,
          costUsd: totalCostUsd,
          iterations,
          messages,
          events,
        };
      }

      if (response.stop_reason !== "tool_use") {
        return {
          status: "error",
          reason: `Unexpected stop_reason: ${response.stop_reason}`,
          traceId,
          costUsd: totalCostUsd,
          iterations,
          messages,
          events,
        };
      }

      const toolCalls = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
      );
      const results: Anthropic.ToolResultBlockParam[] = [];

      for (const call of toolCalls) {
        const policyResult = await this.policy.check({
          tool: call.name,
          input: call.input as Record<string, unknown>,
          context: ctx,
        });

        if (!policyResult.allowed) {
          await emit({
            traceId,
            type: "policy.denied",
            actor: ctx.userId,
            payload: {
              tool: call.name,
              input: call.input,
              reason: policyResult.reason,
            },
          });
          results.push({
            type: "tool_result",
            tool_use_id: call.id,
            content: `POLICY_DENIED: ${policyResult.reason}`,
            is_error: true,
          });
          continue;
        }

        const toolStart = Date.now();
        try {
          const output = await this.tools.invoke(call.name, call.input, ctx);
          const toolDuration = Date.now() - toolStart;
          await emit({
            traceId,
            type: "tool.invoked",
            actor: ctx.userId,
            payload: {
              tool: call.name,
              input: call.input,
              output,
              durationMs: toolDuration,
            },
          });
          results.push({
            type: "tool_result",
            tool_use_id: call.id,
            content:
              typeof output === "string" ? output : JSON.stringify(output),
          });
        } catch (e) {
          const toolDuration = Date.now() - toolStart;
          const message = e instanceof Error ? e.message : String(e);
          await emit({
            traceId,
            type: "tool.error",
            actor: ctx.userId,
            payload: {
              tool: call.name,
              error: message,
              durationMs: toolDuration,
            },
          });
          results.push({
            type: "tool_result",
            tool_use_id: call.id,
            content: `ERROR: ${message}`,
            is_error: true,
          });
        }
      }

      messages.push({ role: "user", content: results });
    }

    await emit({
      traceId,
      type: "agent.iteration_limit",
      payload: { iterations: this.maxIterations },
    });
    return {
      status: "iteration_limit",
      reason: `Hit max iterations (${this.maxIterations})`,
      traceId,
      costUsd: totalCostUsd,
      iterations,
      messages,
      events,
    };
  }
}

/**
 * Rough cost estimate. Replace with a per-model pricing table loaded from
 * config in production. These numbers are placeholders.
 */
function estimateCost(_model: string, usage?: Anthropic.Usage): number {
  if (!usage) return 0;
  const inputPer1M = 3.0;
  const outputPer1M = 15.0;
  return (
    (usage.input_tokens * inputPer1M + usage.output_tokens * outputPer1M) /
    1_000_000
  );
}
