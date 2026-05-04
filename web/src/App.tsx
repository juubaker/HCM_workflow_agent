import { useEffect, useState } from "react";
import { Header } from "./components/Header";
import { ConsolePanel } from "./components/ConsolePanel";
import { AuditPanel } from "./components/AuditPanel";
import { MetricsPanel } from "./components/MetricsPanel";
import type {
  AuditEvent,
  ChatMessage,
  Identity,
  ServerMetadata,
  Tab,
} from "./lib/types";
import { fetchMetadata } from "./lib/api";

export function App() {
  const [tab, setTab] = useState<Tab>("console");
  const [identity, setIdentity] = useState<Identity>({
    userId: "emp-001",
    roles: ["employee", "manager"],
  });
  const [history, setHistory] = useState<any[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [metadata, setMetadata] = useState<ServerMetadata | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  // Bootstrap: fetch server metadata once. If this fails, the backend isn't
  // running — show a helpful message instead of letting every API call error.
  useEffect(() => {
    fetchMetadata()
      .then(setMetadata)
      .catch((e) => setServerError(e instanceof Error ? e.message : String(e)));
  }, []);

  // Reset chat history when identity changes — different user means a different
  // conversation, and previous messages would carry stale role assumptions.
  useEffect(() => {
    setHistory([]);
    setMessages([]);
  }, [identity.userId]);

  if (serverError) {
    return <ServerErrorScreen error={serverError} />;
  }

  return (
    <div className="h-screen flex flex-col">
      <Header
        tab={tab}
        onTabChange={setTab}
        identity={identity}
        onIdentityChange={setIdentity}
        liveCount={tab === "console" ? events.length : 0}
      />

      {tab === "console" && (
        <ConsolePanel
          identity={identity}
          history={history}
          setHistory={setHistory}
          messages={messages}
          setMessages={setMessages}
          events={events}
          setEvents={setEvents}
        />
      )}
      {tab === "audit" && <AuditPanel />}
      {tab === "metrics" && <MetricsPanel />}

      <Footer metadata={metadata} />
    </div>
  );
}

function Footer({ metadata }: { metadata: ServerMetadata | null }) {
  return (
    <footer className="border-t border-ink-700 bg-ink-900/50 px-6 py-2">
      <div className="flex items-center justify-between font-mono text-[10px] text-ink-500">
        <div className="flex gap-4">
          <span>connected</span>
          {metadata && (
            <>
              <span>·</span>
              <span>{metadata.model}</span>
              <span>·</span>
              <span>{metadata.tools.length} tools</span>
              <span>·</span>
              <span>${metadata.maxCostUsd.toFixed(2)}/session cap</span>
            </>
          )}
        </div>
        <div className="flex gap-3">
          <span>policy gate · cost cap · audit trail</span>
        </div>
      </div>
    </footer>
  );
}

function ServerErrorScreen({ error }: { error: string }) {
  return (
    <div className="h-screen flex items-center justify-center px-6">
      <div className="max-w-lg text-center">
        <div className="font-display italic text-5xl text-ink-300 mb-4">
          Backend unreachable
        </div>
        <div className="text-ink-400 mb-6 leading-relaxed">
          The agent server isn't responding on localhost:3000. Start it with{" "}
          <code className="font-mono text-amber bg-ink-800 px-1.5 py-0.5">
            npm run server
          </code>{" "}
          in a separate terminal, then refresh.
        </div>
        <details className="text-left">
          <summary className="font-mono text-xs text-ink-400 cursor-pointer hover:text-ink-200">
            error details
          </summary>
          <pre className="mt-2 font-mono text-[10px] text-denied bg-ink-900 p-3 overflow-x-auto">
            {error}
          </pre>
        </details>
      </div>
    </div>
  );
}
