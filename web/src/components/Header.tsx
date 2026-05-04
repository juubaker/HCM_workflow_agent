import type { Identity, Tab } from "../lib/types";

interface HeaderProps {
  tab: Tab;
  onTabChange: (tab: Tab) => void;
  identity: Identity;
  onIdentityChange: (id: Identity) => void;
  liveCount: number;
}

const TABS: { id: Tab; label: string; sub: string }[] = [
  { id: "console", label: "Console", sub: "01" },
  { id: "audit", label: "Audit", sub: "02" },
  { id: "metrics", label: "Metrics", sub: "03" },
];

const PRESETS: { label: string; identity: Identity }[] = [
  { label: "Employee", identity: { userId: "emp-002", roles: ["employee"] } },
  {
    label: "Manager",
    identity: { userId: "emp-001", roles: ["employee", "manager"] },
  },
  { label: "HR Admin", identity: { userId: "hr-007", roles: ["hr_admin"] } },
];

export function Header({
  tab,
  onTabChange,
  identity,
  onIdentityChange,
  liveCount,
}: HeaderProps) {
  return (
    <header className="border-b border-ink-700 bg-ink-900/80 backdrop-blur-sm">
      <div className="flex items-stretch h-14">
        {/* Brand mark */}
        <div className="flex items-center px-6 border-r border-ink-700">
          <div className="flex flex-col leading-none">
            <span className="font-display italic text-xl text-amber tracking-tight">
              Anvil
            </span>
            <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-ink-400 mt-0.5">
              Operator Console
            </span>
          </div>
        </div>

        {/* Tabs */}
        <nav className="flex">
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => onTabChange(t.id)}
                className={`group relative flex items-baseline gap-2 px-6 transition-colors ${
                  active
                    ? "text-ink-100 bg-ink-800"
                    : "text-ink-300 hover:text-ink-100 hover:bg-ink-800/50"
                }`}
              >
                <span className="font-mono text-[10px] text-ink-500">{t.sub}</span>
                <span className="font-medium tracking-tight">{t.label}</span>
                {active && (
                  <span className="absolute bottom-0 left-0 right-0 h-px bg-amber" />
                )}
              </button>
            );
          })}
        </nav>

        <div className="flex-1" />

        {/* Live counter */}
        {liveCount > 0 && (
          <div className="flex items-center px-4 border-l border-ink-700">
            <span className="live-dot text-amber w-2 h-2 rounded-full bg-amber inline-block" />
            <span className="ml-3 font-mono text-xs text-ink-300">
              {liveCount} {liveCount === 1 ? "event" : "events"}
            </span>
          </div>
        )}

        {/* Identity selector */}
        <div className="flex items-center px-4 border-l border-ink-700">
          <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink-400 mr-3">
            Acting as
          </span>
          <div className="flex">
            {PRESETS.map((p) => {
              const active = p.identity.userId === identity.userId;
              return (
                <button
                  key={p.label}
                  onClick={() => onIdentityChange(p.identity)}
                  className={`px-3 py-1 font-mono text-xs border-hairline ${
                    active
                      ? "bg-amber text-ink-950 border-amber"
                      : "border-ink-600 text-ink-300 hover:border-ink-400 hover:text-ink-100"
                  } [&:not(:first-child)]:-ml-px`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
          <div className="ml-4 flex flex-col leading-tight">
            <span className="font-mono text-xs text-ink-200">
              {identity.userId}
            </span>
            <span className="font-mono text-[10px] text-ink-400">
              {identity.roles.join(" · ")}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
