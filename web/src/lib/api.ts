import type { AgentResult, AuditEvent, Identity, ServerMetadata } from "./types";

async function jsonFetch<T>(
  url: string,
  init?: RequestInit & { identity?: Identity }
): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");
  if (init?.identity) {
    headers.set("x-user-id", init.identity.userId);
    headers.set("x-roles", init.identity.roles.join(","));
  }
  const res = await fetch(url, { ...init, headers });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}: ${body}`);
  }
  return res.json();
}

export async function postChat(
  message: string,
  history: any[],
  identity: Identity
): Promise<AgentResult> {
  return jsonFetch<AgentResult>("/chat", {
    method: "POST",
    body: JSON.stringify({ message, history }),
    identity,
  });
}

export async function fetchAudit(
  limit = 500
): Promise<{ events: AuditEvent[]; total: number }> {
  return jsonFetch<{ events: AuditEvent[]; total: number }>(
    `/audit?limit=${limit}`
  );
}

export async function fetchMetadata(): Promise<ServerMetadata> {
  return jsonFetch<ServerMetadata>("/metadata");
}
