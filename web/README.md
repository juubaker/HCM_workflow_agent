# Operator Console

The web dashboard for the enterprise workflow agent. Three views into the agent: live chat with inline trace, full audit log, and aggregate metrics.

## Run

The dashboard talks to the agent's HTTP server. Start both:

```bash
# Terminal 1 — backend
npm run server

# Terminal 2 — frontend
npm run web
```

Open [http://localhost:5173](http://localhost:5173).

If you see "Backend unreachable," the server in terminal 1 isn't running yet. Start it and refresh.

## What the three tabs show

**Console.** Send messages to the agent on the left, watch the trace populate on the right in real time. Each tool call, policy decision, and LLM iteration appears as it happens, with token counts, durations, and cost per call. Try changing identity at the top — same query, different roles, watch policy denials kick in.

**Audit.** All events ever written to the audit log, grouped by trace ID. Filter by event type. This is the SOX/SOC2 view — every action attributed to a user, every denial logged with a reason, every cost tracked.

**Metrics.** Aggregated from the audit log: per-tool latency (avg, p50, p99), call counts, error rates, policy denial counts. Refreshes on demand. This is the operations view.

## Design

Built with Vite + React + Tailwind. Custom theme in `tailwind.config.js`:

- **Typography** — Fraunces (display), Manrope (UI), JetBrains Mono (data)
- **Palette** — warm dark slate with a single sodium-vapor amber accent
- **Layout** — dense, technical, designed for operators not consumers

No UI component library — every component is in `src/components/`. Total bundle is ~170 KB JS, ~16 KB CSS gzipped.

## API contract

The frontend hits four endpoints on the backend:

| Endpoint | Purpose |
| --- | --- |
| `GET /healthz` | Liveness probe |
| `GET /metadata` | Bootstrap: model, tools, budget caps |
| `POST /chat` | Run the agent for one turn |
| `GET /audit` | Read persisted audit log |

All four are documented in [`../docs/api.md`](../docs/api.md).

## Production notes

This dashboard is a development and demo tool. For production:

- **Don't expose `/audit` publicly.** It returns the full audit stream. Move it behind admin auth or remove it entirely from production builds.
- **Don't use the identity selector.** It's a demo affordance that lets you switch users by clicking a button — useful for showing policy enforcement, terrible for production where identity comes from a verified token.
- **Build with `npm run web:build`** and serve the static output from a CDN. The dev server is for development only.
- **Pin the backend origin.** `vite.config.ts` proxies to localhost:3000 for development. Production deployments either serve the dashboard from the same origin or set explicit CORS allowlists on the backend.
