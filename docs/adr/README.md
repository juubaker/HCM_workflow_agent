# Architecture Decision Records

This directory captures the major architectural decisions made on this project. Each ADR documents one decision with its context, the alternatives considered, the choice made, and the consequences.

ADRs are immutable once accepted. If a decision changes, write a new ADR that supersedes the old one rather than editing history.

## Format

Each ADR follows Michael Nygard's classic format:

```markdown
# Title

## Status

Accepted | Proposed | Deprecated | Superseded by ADR-NNNN

## Context

What is the issue we're seeing that is motivating this decision?

## Decision

What is the change that we're proposing or have agreed to?

## Consequences

What becomes easier or more difficult because of this change?
```

## Index

| # | Title | Status |
| --- | --- | --- |
| [0001](./0001-policy-engine-as-central-gate.md) | Policy engine as central gate | Accepted |
| [0002](./0002-cost-and-iteration-budgets.md) | Cost and iteration budgets | Accepted |
| [0003](./0003-hcm-client-as-interface.md) | HCMClient as interface, not SDK dependency | Accepted |
| [0004](./0004-evals-alongside-tests.md) | Evals alongside unit tests | Accepted |

## When to write a new ADR

Write one when:

- A decision affects multiple modules or layers
- The decision has tradeoffs that aren't obvious from the code
- The team would have to re-derive the rationale if the file went missing

Don't write one for:

- Implementation details that the code itself makes clear
- Minor style or naming choices
- Library version bumps without behavior changes

The bar is "would a new senior engineer joining this codebase need this context to make consistent decisions?"
