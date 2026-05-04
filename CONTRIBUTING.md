# Contributing

Thanks for your interest in this project. This document describes how to set up your environment, the code conventions in use, and how to propose changes.

## Development setup

Requirements: Node.js 20+, an Anthropic API key.

```bash
git clone <repo-url>
cd enterprise-workflow-agent
npm install
cp .env.example .env       # add your ANTHROPIC_API_KEY
```

Verify the install:

```bash
npm test                   # 36 unit tests
npm run dev                # interactive CLI
```

## Project layout

The project is organized so each concern lives in one place:

| Concern | Location |
| --- | --- |
| Agent core (LLM loop, tool dispatch) | `src/orchestrator.ts` |
| Tool definitions | `src/tools/` |
| Policy rules and engine | `src/policy/` |
| External integrations | `src/integrations/` |
| Audit logging and tracing | `src/observability/` |
| Behavioral evals | `evals/` |
| Unit tests (mirror `src/`) | `tests/` |

## Common tasks

How-to walkthroughs in [`docs/`](./docs/):

- [Add a new tool](./docs/adding-a-tool.md)
- [Add a new policy rule](./docs/adding-a-policy-rule.md)
- [Deploy to production](./docs/deployment.md)
- [API reference](./docs/api.md)

For background on architectural choices, see the [ADRs](./docs/adr/).

## Code conventions

- **TypeScript strict mode**, ES modules, NodeNext resolution. No `any` without an explicit comment justifying it.
- **Comments explain *why*, not *what*.** If a line of code answers "why is it this way" — a tradeoff, a constraint, a non-obvious decision — that goes in a comment. Mechanical narration ("this loops over the array") does not.
- **Errors that are expected outcomes are not exceptions.** `AgentResult` returns `status: "budget_exceeded"` rather than throwing. Real errors (network, schema violations) still throw.
- **Interfaces over SDKs.** Agent code depends on `HCMClient`, not on `@oracle/hcm-cloud`. New integrations follow the same pattern.
- **Tests mirror source layout.** `src/foo/bar.ts` → `tests/foo/bar.test.ts`.

## Testing

Two test layers, both required to pass before merging:

```bash
npm test                   # unit tests, fast, no API key needed
npm run eval               # behavioral evals, slow, real model, costs money
```

Unit tests use a fake Anthropic client (`tests/helpers/fake-anthropic.ts`) so they're deterministic. Evals use the real model.

## Commit messages

Use focused, present-tense summaries:

- ✅ "Add multi-tenant scoping to AgentContext"
- ✅ "Fix race condition in audit log append"
- ❌ "Updated stuff"
- ❌ "various changes"

If the change has a non-obvious rationale, explain it in the commit body. Treat commit history as documentation — your future self and your interviewers will read it.

## Submitting changes

1. Open an issue describing the change you want to make (skip for trivial fixes).
2. Branch from `main`. Branch names: `feat/short-description`, `fix/short-description`.
3. Make the change. Include tests.
4. Ensure `npm test` passes locally.
5. Open a PR linking to the issue. Describe what changed and why.

## Adding documentation

- **New top-level concept** (concerns the whole system): add to `README.md` or `ARCHITECTURE.md`.
- **New module-specific docs**: inline `README.md` in the module folder.
- **New how-to walkthrough**: add a file in `docs/`.
- **New architectural decision**: add an ADR in `docs/adr/`. See [`docs/adr/README.md`](./docs/adr/README.md) for the format.
