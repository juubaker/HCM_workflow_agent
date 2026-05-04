import express, { Request, Response } from "express";
import cors from "cors";
import { promises as fs } from "node:fs";
import Anthropic from "@anthropic-ai/sdk";
import { config, assertConfig } from "./config.js";
import { Orchestrator } from "./orchestrator.js";
import { ToolRegistry } from "./tools/registry.js";
import { benefitsTools } from "./tools/benefits.js";
import { timeoffTools } from "./tools/timeoff.js";
import { approvalTools } from "./tools/approvals.js";
import { PolicyEngine } from "./policy/engine.js";
import {
  enforceSelfServiceScope,
  enforceApprovalAuthority,
  enforceEnrollmentWindow,
} from "./policy/rules.js";
import { MockHCMClient } from "./integrations/mock-hcm.js";
import { FileAuditLogger } from "./observability/audit.js";

assertConfig();

const app = express();
// CORS open in dev so the Vite frontend on a different port can hit /chat.
// Production should narrow this to the deployed origin or remove it entirely
// if the frontend is served from the same origin.
app.use(cors());
app.use(express.json({ limit: "1mb" }));

const client = new Anthropic({ apiKey: config.anthropicApiKey });
const hcm = new MockHCMClient();

const tools = new ToolRegistry();
for (const t of [
  ...benefitsTools(hcm),
  ...timeoffTools(hcm),
  ...approvalTools(hcm),
]) {
  tools.register(t);
}

const policy = new PolicyEngine()
  .use(enforceSelfServiceScope)
  .use(enforceApprovalAuthority)
  .use(
    enforceEnrollmentWindow(new Date("2026-04-01"), new Date("2026-05-31"))
  );

const audit = new FileAuditLogger(config.auditPath);

const orchestrator = new Orchestrator({
  client,
  tools,
  policy,
  audit,
  model: config.model,
  maxIterations: config.maxIterations,
  maxCostUsd: config.maxCostUsd,
});

/**
 * Placeholder for real auth middleware. In production this is a JWT verifier
 * that populates req.user from a validated token. Here we accept identity
 * via headers for local development only.
 */
function authContext(req: Request) {
  const userId = (req.headers["x-user-id"] as string) ?? "emp-001";
  const roles = ((req.headers["x-roles"] as string) ?? "employee").split(",");
  return { userId, roles };
}

app.get("/healthz", (_req: Request, res: Response) => {
  res.json({ ok: true });
});

/**
 * Bootstrap data for the UI: tool catalog, policy rules in effect, model.
 * Used by the dashboard's About panel and to size the metrics view.
 */
app.get("/metadata", (_req: Request, res: Response) => {
  res.json({
    model: config.model,
    maxIterations: config.maxIterations,
    maxCostUsd: config.maxCostUsd,
    tools: tools.schemas().map((t) => ({
      name: t.name,
      description: t.description,
    })),
  });
});

app.post("/chat", async (req: Request, res: Response) => {
  const { message, history } = req.body ?? {};
  if (!message || typeof message !== "string") {
    return res.status(400).json({ error: "message required" });
  }
  try {
    const result = await orchestrator.run(
      message,
      authContext(req),
      Array.isArray(history) ? history : []
    );
    return res.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return res.status(500).json({ error: msg });
  }
});

/**
 * Read-back endpoint for the persisted audit log. Returns events in chrono
 * order. Supports `limit` (default 200, max 2000) and `since` (ISO timestamp)
 * for pagination. The current implementation reads the whole file then
 * filters; production should use an indexed store.
 */
app.get("/audit", async (req: Request, res: Response) => {
  const limit = Math.min(parseInt(String(req.query.limit ?? "200"), 10), 2000);
  const since = req.query.since ? String(req.query.since) : null;

  try {
    const content = await fs.readFile(config.auditPath, "utf8").catch(() => "");
    const lines = content.trim().split("\n").filter(Boolean);
    const events = lines.map((l) => JSON.parse(l));
    const filtered = since
      ? events.filter((e) => e.timestamp && e.timestamp > since)
      : events;
    return res.json({ events: filtered.slice(-limit), total: filtered.length });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return res.status(500).json({ error: msg });
  }
});

app.listen(config.port, () => {
  console.log(`Agent server listening on http://localhost:${config.port}`);
});
