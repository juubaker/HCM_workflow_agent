import "dotenv/config";

export const config = {
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
  model: process.env.AGENT_MODEL ?? "claude-opus-4-7",
  port: parseInt(process.env.PORT ?? "3000", 10),
  auditPath: process.env.AUDIT_PATH ?? "./audit.log",
  maxIterations: parseInt(process.env.AGENT_MAX_ITERATIONS ?? "10", 10),
  maxCostUsd: parseFloat(process.env.AGENT_MAX_COST_USD ?? "1.00"),
  trace: process.env.AGENT_TRACE === "1",
};

export function assertConfig(): void {
  if (!config.anthropicApiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY not set. Copy .env.example to .env and fill it in."
    );
  }
}
