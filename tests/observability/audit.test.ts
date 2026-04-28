import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { FileAuditLogger } from "../../src/observability/audit.js";

describe("FileAuditLogger", () => {
  let tmpDir: string;
  let tmpFile: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "audit-test-"));
    tmpFile = path.join(tmpDir, "audit.log");
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("appends one JSONL line per event", async () => {
    const logger = new FileAuditLogger(tmpFile);
    await logger.log({ traceId: "t1", type: "agent.start" });
    await logger.log({ traceId: "t1", type: "agent.end" });

    const content = await fs.readFile(tmpFile, "utf8");
    const lines = content.trim().split("\n");
    expect(lines).toHaveLength(2);

    const first = JSON.parse(lines[0]);
    expect(first.traceId).toBe("t1");
    expect(first.type).toBe("agent.start");
    expect(first.timestamp).toBeDefined();
  });

  it("preserves caller-supplied timestamps", async () => {
    const logger = new FileAuditLogger(tmpFile);
    await logger.log({
      traceId: "t1",
      type: "test",
      timestamp: "2026-01-01T00:00:00Z",
    });

    const content = await fs.readFile(tmpFile, "utf8");
    const event = JSON.parse(content.trim());
    expect(event.timestamp).toBe("2026-01-01T00:00:00Z");
  });

  it("preserves arbitrary payloads as JSON", async () => {
    const logger = new FileAuditLogger(tmpFile);
    await logger.log({
      traceId: "t1",
      type: "tool.invoked",
      actor: "emp-001",
      payload: { tool: "ping", input: { msg: "hi" }, output: { ok: true } },
    });

    const content = await fs.readFile(tmpFile, "utf8");
    const event = JSON.parse(content.trim());
    expect(event.actor).toBe("emp-001");
    expect(event.payload.tool).toBe("ping");
    expect(event.payload.input.msg).toBe("hi");
  });
});
