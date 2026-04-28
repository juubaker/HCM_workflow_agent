import { promises as fs } from "node:fs";

export interface AuditEvent {
  traceId: string;
  type: string;
  actor?: string;
  payload?: unknown;
  timestamp?: string;
}

export interface AuditLogger {
  log(event: AuditEvent): Promise<void>;
}

/**
 * Append-only JSONL audit log. This is a development implementation —
 * production should use an immutable store (e.g., AWS QLDB, S3 Object Lock,
 * or a signed Kafka stream) so events cannot be retroactively edited.
 */
export class FileAuditLogger implements AuditLogger {
  constructor(private readonly path: string) {}

  async log(event: AuditEvent): Promise<void> {
    const enriched = {
      ...event,
      timestamp: event.timestamp ?? new Date().toISOString(),
    };
    await fs.appendFile(this.path, JSON.stringify(enriched) + "\n", "utf8");
  }
}

export class ConsoleAuditLogger implements AuditLogger {
  async log(event: AuditEvent): Promise<void> {
    const enriched = {
      ...event,
      timestamp: event.timestamp ?? new Date().toISOString(),
    };
    console.log(`[AUDIT] ${JSON.stringify(enriched)}`);
  }
}
