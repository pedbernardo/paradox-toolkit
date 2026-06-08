---
name: to-plan
description: Derives a structured execution plan from ADRs and CONTEXT.md. Use after a grilling session to translate settled design decisions into phased, verifiable implementation work.
---

<what-to-do>

Read CONTEXT.md, all docs/adr/, and docs/plans/README.md. Ask what is being planned. Identify which ADRs cover that scope. Generate a draft plan at docs/plans/draft-plan-<name>.md following the format in [PLAN-FORMAT.md](./PLAN-FORMAT.md).

Do not re-debate decisions already settled in ADRs. The "Decisões de design" section is pointers, not rationale. Each phase must have concrete deliverables and a verifiable validation criterion. If the scope is large enough to produce more than ~10 phases, split into multiple plans before writing.

</what-to-do>

<supporting-info>

## Context sources

Read these before generating any plan:

- `CONTEXT.md` - canonical glossary; use its terms in the plan, not synonyms
- `docs/adr/` - settled decisions; the plan references these, it does not repeat their rationale
- `docs/plans/README.md` - naming convention, lifecycle, phase structure, and status values

## What "concrete" means

**Entregas** must name specific artifacts: a file, a function, a type, a behavior. "Implement the scheduler" is not an entrega. "Min-heap keyed on `(executeAt, priority, sequence)` in `engine/src/scheduler/scheduler.ts`" is.

**Testes** lists the test files and what each covers. Omit only when the phase produces no testable logic (pure scaffolding, config). Every phase with business logic gets a Testes section.

**Validação** must be checkable without reading the implementation: a passing test, a `pnpm typecheck` with no errors, a specific observable behavior. "Code is correct" is not a validation.

## Phases

Keep phases small enough to be completed and validated independently. A phase that touches more than one subsystem boundary is probably two phases.

</supporting-info>
