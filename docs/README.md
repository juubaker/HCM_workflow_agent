# Documentation

Extended documentation for the enterprise workflow agent. The top-level [`README.md`](../README.md) and [`ARCHITECTURE.md`](../ARCHITECTURE.md) cover the high-level overview; this directory contains the deeper docs.

## How-to guides

- [Adding a new tool](./adding-a-tool.md) — implementing a new tool handler end-to-end
- [Adding a new policy rule](./adding-a-policy-rule.md) — extending the policy engine
- [API reference](./api.md) — HTTP endpoint shapes
- [Deployment](./deployment.md) — taking the project to production

## Design

- [Architecture Decision Records](./adr/) — the *why* behind the major choices

## Where to put new docs

| Type of doc | Location |
| --- | --- |
| Project overview, quickstart | Root `README.md` |
| System architecture | Root `ARCHITECTURE.md` |
| How others can contribute | Root `CONTRIBUTING.md` |
| How-to walkthroughs | `docs/` |
| Architecture decisions | `docs/adr/` |
| Module-specific notes | Inline `README.md` in the module folder |
| Test or eval suite docs | Inline `README.md` in `tests/` or `evals/` |
