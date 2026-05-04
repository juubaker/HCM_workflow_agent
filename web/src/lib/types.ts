// Mirrors src/observability/audit.ts in the backend
export interface AuditEvent {
  traceId: string;
  type: string;
  actor?: string;
  payload?: any;
  timestamp?: string;
}

// Mirrors src/types.ts in the backend
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
  messages: any[]; // Anthropic.MessageParam[], opaque to the UI
  events: AuditEvent[];
}

export interface Identity {
  userId: string;
  roles: string[];
}

export interface ChatMessage {
  role: "user" | "assistant";
  text: string;
  timestamp: string;
  traceId?: string;
  costUsd?: number;
  iterations?: number;
  status?: AgentStatus;
  reason?: string;
}

export interface ServerMetadata {
  model: string;
  maxIterations: number;
  maxCostUsd: number;
  tools: { name: string; description: string }[];
}

export type Tab = "console" | "audit" | "metrics";
