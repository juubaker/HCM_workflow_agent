import { useEffect, useState } from "react";
import type { AuditEvent } from "../lib/types";
import { fetchAudit } from "../lib/api";
import { EventCard } from "./EventCard";

const FILTERS: { id: string; label: string; match: (t: string) => boolean }[] = [
  { id: "all", label: "All", match: () => true },
  { id: "tool", label: "Tools", match: (t) => t.startsWith("tool.") },
  { id: "policy", label: "Policy", match: (t) => t === "policy.denied" },
  { id: "llm", label: "LLM", match: (t) => t === "llm.call" },
  { id: "agent", label: "Agent", match: (t) => t.startsWith("agent.") },
];

export function AuditPanel() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setLoading(true);
      const data = await fetchAudit(500);
      setEvents(data.events);
      setTotal(data.total);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const matcher = FILTERS.find((f) => f.id === filter)?.match ?? (() => true);
  const filtered = events.filter((e) => matcher(e.type));

  // Group by traceId so the audit reads as sessions, not flat events
  const sessions = groupByTrace(filtered);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex items-baseline gap-6 px-6 py-3 border-b border-ink-700 bg-ink-900/50">
        <div className="flex items-baseline gap-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-400">
            persisted
          </span>
          <h2 className="font-display text-lg italic">Audit Log</h2>
        </div>

        <div className="flex">
          {FILTERS.map((f) => {
            const active = filter === f.id;
            return (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`px-3 py-1 font-mono text-xs border-hairline ${
                  active
                    ? "bg-ink-100 text-ink-950 border-ink-100"
                    : "border-ink-600 text-ink-300 hover:border-ink-400 hover:text-ink-100"
                } [&:not(:first-child)]:-ml-px`}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        <div className="ml-auto flex items-center gap-4">
          <span className="font-mono text-[10px] text-ink-400">
            {filtered.length} of {total}
          </span>
          <button
            onClick={load}
            disabled={loading}
            className="font-mono text-[10px] uppercase tracking-wider text-ink-400 hover:text-amber disabled:opacity-50"
          >
            {loading ? "…" : "↺ refresh"}
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {error && (
          <div className="px-6 py-4 font-mono text-xs text-denied">
            {error}
          </div>
        )}
        {!error && filtered.length === 0 && !loading && (
          <div className="h-full flex flex-col items-center justify-center text-center px-6">
            <div className="font-display italic text-2xl text-ink-300 mb-2">
              No events match
            </div>
            <div className="text-sm text-ink-400 max-w-md">
              {events.length === 0
                ? "Run a session in the Console to populate the audit log."
                : "Try a different filter."}
            </div>
          </div>
        )}
        {sessions.map((session) => (
          <SessionGroup key={session.traceId} session={session} />
        ))}
      </div>
    </div>
  );
}

interface Session {
  traceId: string;
  events: AuditEvent[];
  startedAt: string;
  actor?: string;
}

function groupByTrace(events: AuditEvent[]): Session[] {
  const map = new Map<string, AuditEvent[]>();
  for (const e of events) {
    if (!map.has(e.traceId)) map.set(e.traceId, []);
    map.get(e.traceId)!.push(e);
  }
  return Array.from(map.entries())
    .map(([traceId, evs]) => ({
      traceId,
      events: evs,
      startedAt: evs[0]?.timestamp ?? "",
      actor: evs.find((e) => e.actor)?.actor,
    }))
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

function SessionGroup({ session }: { session: Session }) {
  const startEvent = session.events.find((e) => e.type === "agent.start");
  const startInput = (startEvent?.payload as any)?.input as string | undefined;
  const endEvent = session.events.find(
    (e) => e.type === "agent.end" || e.type.startsWith("agent.budget") || e.type.startsWith("agent.iter")
  );
  const cost = (endEvent?.payload as any)?.costUsd ?? 0;
  const iterations = (endEvent?.payload as any)?.iterations ?? 0;
  const denials = session.events.filter((e) => e.type === "policy.denied").length;

  return (
    <div className="border-b border-ink-700">
      <div className="px-6 py-3 bg-ink-900/30 sticky top-0 backdrop-blur-sm">
        <div className="flex items-baseline gap-4 flex-wrap">
          <span className="font-mono text-[10px] text-amber tracking-wider">
            {session.traceId.slice(0, 8)}
          </span>
          {session.actor && (
            <span className="font-mono text-[10px] text-ink-400">
              {session.actor}
            </span>
          )}
          {startInput && (
            <span className="text-sm text-ink-200 italic font-display">
              "{startInput.length > 80 ? startInput.slice(0, 80) + "…" : startInput}"
            </span>
          )}
          <div className="ml-auto flex gap-4 font-mono text-[10px] text-ink-400">
            <span>{session.events.length} events</span>
            {iterations > 0 && <span>{iterations} iter</span>}
            {cost > 0 && <span>${cost.toFixed(4)}</span>}
            {denials > 0 && (
              <span className="text-denied">{denials} denied</span>
            )}
          </div>
        </div>
      </div>
      <div className="divide-y divide-ink-800/40">
        {session.events.map((e, i) => (
          <EventCard key={i} event={e} compact />
        ))}
      </div>
    </div>
  );
}
