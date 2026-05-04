import type { AuditEvent } from "../lib/types";

interface EventCardProps {
  event: AuditEvent;
  compact?: boolean;
}

const TYPE_META: Record<
  string,
  { label: string; color: string; icon: string }
> = {
  "agent.start": { label: "session start", color: "text-ink-300", icon: "▶" },
  "agent.end": { label: "session end", color: "text-success", icon: "■" },
  "agent.budget_exceeded": {
    label: "budget exceeded",
    color: "text-denied",
    icon: "$",
  },
  "agent.iteration_limit": {
    label: "iteration limit",
    color: "text-denied",
    icon: "↻",
  },
  "llm.call": { label: "llm call", color: "text-llm", icon: "✱" },
  "tool.invoked": { label: "tool", color: "text-info", icon: "▸" },
  "tool.error": { label: "tool error", color: "text-denied", icon: "✕" },
  "policy.denied": { label: "policy denied", color: "text-denied", icon: "⊘" },
};

export function EventCard({ event, compact = false }: EventCardProps) {
  const meta = TYPE_META[event.type] ?? {
    label: event.type,
    color: "text-ink-300",
    icon: "·",
  };
  const time = event.timestamp ? new Date(event.timestamp) : null;
  const timeStr = time
    ? time.toISOString().split("T")[1]?.slice(0, 12) ?? ""
    : "";

  return (
    <div
      className={`group border-l-2 transition-colors hover:bg-ink-900/60 ${meta.color.replace("text-", "border-")} ${compact ? "py-1.5 pl-3 pr-3" : "py-2.5 pl-4 pr-4"}`}
    >
      <div className="flex items-baseline gap-3 font-mono">
        <span className={`${meta.color} text-sm`}>{meta.icon}</span>
        <span className={`${meta.color} text-xs uppercase tracking-wider`}>
          {meta.label}
        </span>
        {event.actor && (
          <span className="text-ink-400 text-[10px]">{event.actor}</span>
        )}
        <span className="ml-auto text-ink-500 text-[10px]">{timeStr}</span>
      </div>
      {!compact && <EventBody event={event} />}
    </div>
  );
}

function EventBody({ event }: { event: AuditEvent }) {
  const p = event.payload as any;
  if (!p) return null;

  switch (event.type) {
    case "agent.start":
      return (
        <div className="mt-1.5 ml-7">
          <div className="text-sm text-ink-200 italic font-display">
            "{p.input}"
          </div>
          <div className="font-mono text-[10px] text-ink-500 mt-1">
            roles: {(p.roles ?? []).join(", ")} · model: {p.model}
          </div>
        </div>
      );
    case "agent.end":
      return (
        <div className="mt-1 ml-7 font-mono text-[10px] text-ink-400">
          {p.iterations} iter · ${p.costUsd?.toFixed(4)}
        </div>
      );
    case "agent.budget_exceeded":
      return (
        <div className="mt-1 ml-7 font-mono text-[11px] text-denied">
          spent ${p.totalCostUsd?.toFixed(4)} of ${p.limit?.toFixed(2)} cap
        </div>
      );
    case "llm.call":
      return (
        <div className="mt-1 ml-7 font-mono text-[10px] text-ink-400 flex flex-wrap gap-x-4 gap-y-0.5">
          <span>iter {p.iteration}</span>
          <span>↓ {p.inputTokens} ↑ {p.outputTokens}</span>
          <span>{p.durationMs}ms</span>
          <span>${p.costUsd?.toFixed(4)}</span>
          <span className="text-ink-500">{p.stopReason}</span>
        </div>
      );
    case "tool.invoked":
      return (
        <div className="mt-1.5 ml-7 space-y-1">
          <div className="font-mono text-xs text-ink-100">
            {p.tool}
            <span className="text-ink-400 ml-2 text-[10px]">{p.durationMs}ms</span>
          </div>
          <div className="font-mono text-[10px] text-ink-400 leading-relaxed break-all">
            {summarize(p.input)} → {summarize(p.output)}
          </div>
        </div>
      );
    case "tool.error":
      return (
        <div className="mt-1.5 ml-7">
          <div className="font-mono text-xs text-ink-200">{p.tool}</div>
          <div className="font-mono text-[10px] text-denied mt-0.5">
            {p.error}
          </div>
        </div>
      );
    case "policy.denied":
      return (
        <div className="mt-1.5 ml-7 space-y-1">
          <div className="font-mono text-xs text-ink-100">
            blocked: <span className="text-denied">{p.tool}</span>
          </div>
          <div className="font-mono text-[10px] text-ink-300 italic">
            {p.reason}
          </div>
          <div className="font-mono text-[9px] text-ink-500">
            input: {summarize(p.input)}
          </div>
        </div>
      );
    default:
      return (
        <div className="mt-1 ml-7 font-mono text-[10px] text-ink-400">
          {summarize(p)}
        </div>
      );
  }
}

function summarize(value: unknown, max = 120): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") {
    return value.length > max ? value.slice(0, max) + "…" : value;
  }
  const json = JSON.stringify(value);
  return json.length > max ? json.slice(0, max) + "…" : json;
}
