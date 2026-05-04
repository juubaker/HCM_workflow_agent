import type Anthropic from "@anthropic-ai/sdk";
import type { AgentContext } from "../types.js";

export interface ToolHandler<TInput = unknown, TOutput = unknown> {
  name: string;
  description: string;
  /** JSON Schema describing the input the LLM must produce. */
  inputSchema: Record<string, unknown>;
  handler: (input: TInput, ctx: AgentContext) => Promise<TOutput>;
}

/**
 * Central tool registry. Holds typed handlers keyed by name and exposes
 * Anthropic-shaped tool definitions for the LLM. The orchestrator never
 * touches handlers directly — it goes through invoke().
 */
export class ToolRegistry {
  private readonly tools = new Map<string, ToolHandler>();

  register(tool: ToolHandler): this {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool "${tool.name}" is already registered`);
    }
    this.tools.set(tool.name, tool);
    return this;
  }

  schemas(): Anthropic.Tool[] {
    return Array.from(this.tools.values()).map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.inputSchema as Anthropic.Tool.InputSchema,
    }));
  }

  async invoke(
    name: string,
    input: unknown,
    ctx: AgentContext
  ): Promise<unknown> {
    const tool = this.tools.get(name);
    if (!tool) throw new Error(`Unknown tool: ${name}`);
    return tool.handler(input, ctx);
  }
}
