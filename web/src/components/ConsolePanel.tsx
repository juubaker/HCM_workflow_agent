import { useEffect, useRef, useState } from "react";
import type {
  AgentResult,
  AuditEvent,
  ChatMessage,
  Identity,
} from "../lib/types";
import { postChat } from "../lib/api";
import { EventCard } from "./EventCard";

interface ConsolePanelProps {
  identity: Identity;
  history: any[];
  setHistory: (h: any[]) => void;
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  events: AuditEvent[];
  setEvents: React.Dispatch<React.SetStateAction<AuditEvent[]>>;
}

export function ConsolePanel({
  identity,
  history,
  setHistory,
  messages,
  setMessages,
  events,
  setEvents,
}: ConsolePanelProps) {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messageScrollRef = useRef<HTMLDivElement>(null);
  const eventScrollRef = useRef<HTMLDivElement>(null);

  // Suggestion buttons in the empty state dispatch a CustomEvent so they
  // don't need to thread setInput through several layers of props.
  useEffect(() => {
    const handler = (e: Event) => {
      const text = (e as CustomEvent<string>).detail;
      setInput(text);
    };
    window.addEventListener("suggestionClick", handler);
    return () => window.removeEventListener("suggestionClick", handler);
  }, []);

  // Auto-scroll panels when new content arrives
  useEffect(() => {
    messageScrollRef.current?.scrollTo({
      top: messageScrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);
  useEffect(() => {
    eventScrollRef.current?.scrollTo({
      top: eventScrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [events]);

  async function handleSend() {
    const text = input.trim();
    if (!text || busy) return;

    setError(null);
    setBusy(true);
    setInput("");

    const userMsg: ChatMessage = {
      role: "user",
      text,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const result: AgentResult = await postChat(text, history, identity);
      setHistory(result.messages);
      setEvents((prev) => [...prev, ...result.events]);
      const assistantMsg: ChatMessage = {
        role: "assistant",
        text: result.text ?? "",
        timestamp: new Date().toISOString(),
        traceId: result.traceId,
        costUsd: result.costUsd,
        iterations: result.iterations,
        status: result.status,
        reason: result.reason,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleReset() {
    setMessages([]);
    setHistory([]);
    setEvents([]);
    setError(null);
  }

  return (
    <div className="grid grid-cols-[minmax(0,5fr)_minmax(0,7fr)] flex-1 min-h-0">
      {/* Chat column */}
      <section className="flex flex-col min-h-0 border-r border-ink-700">
        <PanelHeader title="Conversation" sub="A. user ↔ agent">
          <button
            onClick={handleReset}
            className="font-mono text-[10px] uppercase tracking-wider text-ink-400 hover:text-amber transition-colors"
            disabled={busy || messages.length === 0}
          >
            ↺ reset
          </button>
        </PanelHeader>

        <div ref={messageScrollRef} className="flex-1 min-h-0 overflow-y-auto px-6 py-6">
          {messages.length === 0 ? (
            <EmptyConversation />
          ) : (
            <div className="space-y-6">
              {messages.map((m, i) => (
                <ChatBubble key={i} message={m} />
              ))}
              {busy && <ThinkingIndicator />}
            </div>
          )}
        </div>

        {error && (
          <div className="border-t border-denied/40 bg-denied/10 px-6 py-3">
            <div className="font-mono text-xs text-denied">{error}</div>
          </div>
        )}

        <div className="border-t border-ink-700 bg-ink-900 p-4">
          <div className="flex gap-3 items-end">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={busy}
              rows={1}
              placeholder="Ask the agent…"
              className="flex-1 bg-ink-800 border border-ink-600 px-4 py-2.5 font-sans text-sm text-ink-100 placeholder:text-ink-500 resize-none focus:outline-none focus:border-amber transition-colors disabled:opacity-50"
              style={{ minHeight: "42px", maxHeight: "120px" }}
            />
            <button
              onClick={handleSend}
              disabled={busy || !input.trim()}
              className="px-4 py-2.5 bg-amber text-ink-950 font-mono text-xs uppercase tracking-wider hover:bg-amber-glow transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {busy ? "…" : "Send"}
            </button>
          </div>
          <div className="font-mono text-[10px] text-ink-500 mt-2">
            ⏎ to send · shift+⏎ for newline
          </div>
        </div>
      </section>

      {/* Trace column */}
      <section className="flex flex-col min-h-0">
        <PanelHeader title="Live Trace" sub="B. agent internals">
          <span className="font-mono text-[10px] uppercase tracking-wider text-ink-400">
            {events.length} events
          </span>
        </PanelHeader>

        <div ref={eventScrollRef} className="flex-1 min-h-0 overflow-y-auto">
          {events.length === 0 ? (
            <EmptyTrace />
          ) : (
            <div className="divide-y divide-ink-800/50">
              {events.map((e, i) => (
                <div key={i} className="animate-slide-up">
                  <EventCard event={e} />
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function PanelHeader({
  title,
  sub,
  children,
}: {
  title: string;
  sub: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline gap-3 px-6 py-3 border-b border-ink-700 bg-ink-900/50">
      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-400">
        {sub}
      </span>
      <h2 className="font-display text-lg italic">{title}</h2>
      <div className="ml-auto">{children}</div>
    </div>
  );
}

function ChatBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return (
    <div className="animate-fade-in">
      <div className="font-mono text-[10px] uppercase tracking-wider text-ink-400 mb-1.5">
        {isUser ? "You" : "Agent"}
        {message.iterations !== undefined && (
          <span className="ml-3 text-ink-500 normal-case tracking-normal">
            {message.iterations} iter · ${message.costUsd?.toFixed(4)}
          </span>
        )}
      </div>
      <div
        className={`whitespace-pre-wrap leading-relaxed ${
          isUser
            ? "text-ink-200 font-sans"
            : "text-ink-100 font-sans"
        }`}
      >
        {message.text || (
          <span className="italic text-ink-500">
            {message.reason ?? "(no response)"}
          </span>
        )}
      </div>
      {message.status && message.status !== "ok" && (
        <div className="mt-2 inline-block border border-denied/50 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-denied">
          {message.status}
        </div>
      )}
    </div>
  );
}

function ThinkingIndicator() {
  return (
    <div className="font-mono text-[10px] uppercase tracking-wider text-ink-400">
      Agent
      <span className="ml-3 inline-flex gap-1">
        <span className="w-1 h-1 bg-amber rounded-full animate-pulse" />
        <span
          className="w-1 h-1 bg-amber rounded-full animate-pulse"
          style={{ animationDelay: "0.2s" }}
        />
        <span
          className="w-1 h-1 bg-amber rounded-full animate-pulse"
          style={{ animationDelay: "0.4s" }}
        />
      </span>
    </div>
  );
}

function EmptyConversation() {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center px-6">
      <div className="font-display italic text-3xl text-ink-300 mb-3">
        Start a conversation
      </div>
      <div className="text-sm text-ink-400 max-w-md text-balance leading-relaxed">
        Ask about benefits, time off, or pending approvals. Try changing your
        identity at the top to see policy enforcement in action.
      </div>
      <div className="mt-8 grid gap-2 w-full max-w-md">
        <Suggestion text="What benefits plans are available to me?" />
        <Suggestion text="What's my PTO balance?" />
        <Suggestion text="Show me emp-002's PTO balance" />
        <Suggestion text="What approvals are pending for me?" />
      </div>
    </div>
  );
}

function Suggestion({ text }: { text: string }) {
  return (
    <button
      onClick={() => {
        const event = new CustomEvent("suggestionClick", { detail: text });
        window.dispatchEvent(event);
      }}
      className="text-left px-4 py-2.5 border-hairline border-ink-600 hover:border-amber font-mono text-xs text-ink-300 hover:text-ink-100 transition-colors"
    >
      → {text}
    </button>
  );
}

function EmptyTrace() {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center px-6">
      <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-ink-500 mb-2">
        awaiting input
      </div>
      <div className="text-sm text-ink-400 max-w-xs text-balance leading-relaxed">
        Tool calls, policy decisions, and LLM iterations stream here as the
        agent works.
      </div>
    </div>
  );
}
