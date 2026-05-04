import { useEffect, useState } from "react";
import type { AuditEvent } from "../lib/types";
import { fetchAudit } from "../lib/api";

interface ToolMetric {
  tool: string;
  count: number;
  errors: number;
  policyDenied: number;
  totalDurationMs: number;
  avgMs: number;
  p50Ms: number;
  p99Ms: number;
}

interface AggregateStats {
  totalSessions: number;
  totalIterations: number;
  totalCostUsd: number;
  avgCostPerSession: number;
  totalEvents: number;
  totalToolCalls: number;
  totalPolicyDenials: number;
  totalLlmCalls: number;
  avgLlmDurationMs: number;
}

export function MetricsPanel() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setLoading(true);
      const data = await fetchAudit(2000);
      setEvents(data.events);
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

  const aggregate = computeAggregates(events);
  const toolMetrics = computeToolMetrics(events);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex items-baseline gap-3 px-6 py-3 border-b border-ink-700 bg-ink-900/50">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-400">
          aggregate
        </span>
        <h2 className="font-display text-lg italic">Metrics</h2>
        <div className="ml-auto flex items-center gap-4">
          <span className="font-mono text-[10px] text-ink-400">
            {events.length} events analyzed
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

      <div className="flex-1 min-h-0 overflow-y-auto px-6 py-6">
        {error && (
          <div className="font-mono text-xs text-denied mb-4">{error}</div>
        )}
        {events.length === 0 && !loading ? (
          <EmptyMetrics />
        ) : (
          <div className="max-w-6xl mx-auto space-y-10">
            <Section title="Sessions">
              <StatGrid>
                <Stat label="Sessions" value={aggregate.totalSessions} />
                <Stat
                  label="Total cost"
                  value={`$${aggregate.totalCostUsd.toFixed(4)}`}
                />
                <Stat
                  label="Avg / session"
                  value={`$${aggregate.avgCostPerSession.toFixed(4)}`}
                />
                <Stat label="Iterations" value={aggregate.totalIterations} />
              </StatGrid>
            </Section>

            <Section title="Activity">
              <StatGrid>
                <Stat label="LLM calls" value={aggregate.totalLlmCalls} />
                <Stat
                  label="Avg LLM ms"
                  value={Math.round(aggregate.avgLlmDurationMs)}
                />
                <Stat label="Tool calls" value={aggregate.totalToolCalls} />
                <Stat
                  label="Policy denials"
                  value={aggregate.totalPolicyDenials}
                  accent={aggregate.totalPolicyDenials > 0 ? "denied" : undefined}
                />
              </StatGrid>
            </Section>

            <Section title="Per-tool latency">
              <ToolTable metrics={toolMetrics} />
            </Section>
          </div>
        )}
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="font-display italic text-2xl text-ink-100 mb-4">
        {title}
      </h3>
      {children}
    </section>
  );
}

function StatGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-ink-700">{children}</div>;
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: "denied" | "success";
}) {
  const accentColor =
    accent === "denied"
      ? "text-denied"
      : accent === "success"
        ? "text-success"
        : "text-ink-100";
  return (
    <div className="bg-ink-900 px-5 py-6">
      <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink-400">
        {label}
      </div>
      <div className={`font-display text-4xl mt-2 ${accentColor} tabular-nums`}>
        {value}
      </div>
    </div>
  );
}

function ToolTable({ metrics }: { metrics: ToolMetric[] }) {
  if (metrics.length === 0) {
    return (
      <div className="text-sm text-ink-400 italic">No tool calls recorded yet.</div>
    );
  }
  return (
    <div className="border border-ink-700">
      <table className="w-full">
        <thead>
          <tr className="border-b border-ink-700 bg-ink-900/40">
            <th className="text-left px-4 py-2 font-mono text-[10px] uppercase tracking-wider text-ink-400">
              Tool
            </th>
            <th className="text-right px-4 py-2 font-mono text-[10px] uppercase tracking-wider text-ink-400">
              Calls
            </th>
            <th className="text-right px-4 py-2 font-mono text-[10px] uppercase tracking-wider text-ink-400">
              Errors
            </th>
            <th className="text-right px-4 py-2 font-mono text-[10px] uppercase tracking-wider text-ink-400">
              Denied
            </th>
            <th className="text-right px-4 py-2 font-mono text-[10px] uppercase tracking-wider text-ink-400">
              Avg ms
            </th>
            <th className="text-right px-4 py-2 font-mono text-[10px] uppercase tracking-wider text-ink-400">
              p50
            </th>
            <th className="text-right px-4 py-2 font-mono text-[10px] uppercase tracking-wider text-ink-400">
              p99
            </th>
          </tr>
        </thead>
        <tbody>
          {metrics.map((m) => (
            <tr
              key={m.tool}
              className="border-b border-ink-800 last:border-b-0 hover:bg-ink-900/30"
            >
              <td className="px-4 py-2.5 font-mono text-xs text-ink-100">
                {m.tool}
              </td>
              <td className="text-right px-4 py-2.5 font-mono text-xs text-ink-200 tabular-nums">
                {m.count}
              </td>
              <td
                className={`text-right px-4 py-2.5 font-mono text-xs tabular-nums ${m.errors > 0 ? "text-denied" : "text-ink-500"}`}
              >
                {m.errors}
              </td>
              <td
                className={`text-right px-4 py-2.5 font-mono text-xs tabular-nums ${m.policyDenied > 0 ? "text-denied" : "text-ink-500"}`}
              >
                {m.policyDenied}
              </td>
              <td className="text-right px-4 py-2.5 font-mono text-xs text-ink-200 tabular-nums">
                {Math.round(m.avgMs)}
              </td>
              <td className="text-right px-4 py-2.5 font-mono text-xs text-ink-300 tabular-nums">
                {Math.round(m.p50Ms)}
              </td>
              <td className="text-right px-4 py-2.5 font-mono text-xs text-ink-300 tabular-nums">
                {Math.round(m.p99Ms)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EmptyMetrics() {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center py-16">
      <div className="font-display italic text-3xl text-ink-300 mb-3">
        Nothing to measure yet
      </div>
      <div className="text-sm text-ink-400 max-w-md text-balance leading-relaxed">
        Send a few messages in the Console tab. Aggregates appear here once
        events are written to the audit log.
      </div>
    </div>
  );
}

function computeAggregates(events: AuditEvent[]): AggregateStats {
  const traceIds = new Set<string>();
  let totalIterations = 0;
  let totalCostUsd = 0;
  let totalToolCalls = 0;
  let totalPolicyDenials = 0;
  let totalLlmCalls = 0;
  let totalLlmDurationMs = 0;

  for (const e of events) {
    traceIds.add(e.traceId);
    const p = e.payload as any;
    if (e.type === "agent.end") {
      totalCostUsd += p?.costUsd ?? 0;
      totalIterations += p?.iterations ?? 0;
    }
    if (e.type === "tool.invoked") totalToolCalls++;
    if (e.type === "policy.denied") totalPolicyDenials++;
    if (e.type === "llm.call") {
      totalLlmCalls++;
      totalLlmDurationMs += p?.durationMs ?? 0;
    }
  }

  return {
    totalSessions: traceIds.size,
    totalIterations,
    totalCostUsd,
    avgCostPerSession: traceIds.size > 0 ? totalCostUsd / traceIds.size : 0,
    totalEvents: events.length,
    totalToolCalls,
    totalPolicyDenials,
    totalLlmCalls,
    avgLlmDurationMs: totalLlmCalls > 0 ? totalLlmDurationMs / totalLlmCalls : 0,
  };
}

function computeToolMetrics(events: AuditEvent[]): ToolMetric[] {
  const byTool = new Map<
    string,
    { durations: number[]; errors: number; denied: number }
  >();

  for (const e of events) {
    const p = e.payload as any;
    if (e.type === "tool.invoked") {
      const tool = p?.tool;
      if (!tool) continue;
      if (!byTool.has(tool)) byTool.set(tool, { durations: [], errors: 0, denied: 0 });
      byTool.get(tool)!.durations.push(p?.durationMs ?? 0);
    } else if (e.type === "tool.error") {
      const tool = p?.tool;
      if (!tool) continue;
      if (!byTool.has(tool)) byTool.set(tool, { durations: [], errors: 0, denied: 0 });
      byTool.get(tool)!.errors++;
    } else if (e.type === "policy.denied") {
      const tool = p?.tool;
      if (!tool) continue;
      if (!byTool.has(tool)) byTool.set(tool, { durations: [], errors: 0, denied: 0 });
      byTool.get(tool)!.denied++;
    }
  }

  return Array.from(byTool.entries())
    .map(([tool, { durations, errors, denied }]) => {
      const sorted = [...durations].sort((a, b) => a - b);
      const sum = sorted.reduce((a, b) => a + b, 0);
      return {
        tool,
        count: durations.length,
        errors,
        policyDenied: denied,
        totalDurationMs: sum,
        avgMs: sorted.length > 0 ? sum / sorted.length : 0,
        p50Ms: percentile(sorted, 0.5),
        p99Ms: percentile(sorted, 0.99),
      };
    })
    .sort((a, b) => b.count - a.count);
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * p));
  return sorted[idx];
}
