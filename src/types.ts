import type { MessageParam } from "@anthropic-ai/sdk/resources/messages.js";

/**
 * Identity and roles passed through every layer of the agent.
 * In production this is constructed from a validated JWT or similar.
 */
export interface AgentContext {
  userId: string;
  roles: string[];
  traceId?: string;
  metadata?: Record<string, unknown>;
}

export type AgentStatus =
  | "ok"
  | "iteration_limit"
  | "budget_exceeded"
  | "error";

export interface AgentResult {
  status: AgentStatus;
  text?: string;
  reason?: string;
  traceId: string;
  costUsd: number;
  iterations: number;
  /** Full message history after the run, suitable for threading into the next run() call. */
  messages: MessageParam[];
}
