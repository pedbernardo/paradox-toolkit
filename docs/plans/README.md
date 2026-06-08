# Plans

This directory centralizes execution and tracking plans for the project.

**Usage rules:**

- each plan must reference this `README.md` at the top
- each plan must record only what is specific to its scope
- each plan must use local phase numbering, with no reference to global numbering

## Common base structure

All plans in this directory share the same set of project-wide structural documents:

- [CONTEXT.md](../../CONTEXT.md) — canonical domain glossary
- [CLAUDE.md](../../CLAUDE.md) — project commands, architecture, and invariants
- [docs/adr/](../adr/) — architectural decisions with rationale

Each plan may add its own references when the scope demands it, but this set is the common baseline.

## Plan naming convention and lifecycle

Files in `plans/` follow a prefix convention that reflects each plan's state and defines the visual order in the file system:

| Prefix        | Example                     | Meaning                                                                                          |
| ------------- | --------------------------- | ------------------------------------------------------------------------------------------------ |
| `draft-`      | `draft-plan-scheduler.md`   | **In planning.** No number because the execution order is not yet defined.                       |
| `N-` (number) | `01-plan-scheduler.md`      | Ready for execution or in progress. The number defines the execution order among plans.          |
| `done-N-`     | `done-01-plan-scheduler.md` | **Completed.** The number preserves the historical execution order.                              |

> Numbers are always two digits (`01`, `02`, ...), ensuring correct alphabetical ordering up to plan 99.

> Natural alphabetical ordering produces the desired hierarchy: numbered plans at the top (highest immediate relevance), completed in the middle, drafts at the end.

**Transition rules:**

- when starting a `draft-` plan, assign a number and rename to `NN-plan-*.md`
- when completing a plan, rename from `NN-plan-*.md` to `done-NN-plan-*.md`
- the number never changes — it records the historical position in the execution sequence

Plans are self-contained, but the numbering allows the project's evolution order to be reconstructed.

## Common assumptions

- dependencies are never added manually to `package.json`; always added via `pnpm add`
- shared dependencies must be centralized in the `catalog` of `pnpm-workspace.yaml`
- each plan must remain small and focused on a clear scope
- long plans must be split before they become expensive maintenance context
- file names in `plans/` must use `lowercase kebab-case`

## Tracking convention

Each phase must record:

- **objective** — the state at the end of the phase, not a task
- **status** — see allowed values below
- **deliverables** — concrete artifacts: file, function, type, behavior
- **tests** — test files and what each covers; omit only in phases with no testable logic
- **validation** — a criterion checkable by someone who did not write the code

Allowed status values:

- `not started`
- `in progress`
- `completed`
- `blocked`
- `cancelled`

## Commit strategy

When completing each phase, evaluate which of the three commit strategies applies:

**Commit per phase** — default preference. Apply when the phase delivers a cohesive, independently tested artifact. Each commit represents a functional state of the system. Message follows Conventional Commits with the affected package scope: `feat(engine): add scheduler min-heap with (executeAt, priority, sequence) ordering`.

**Commit per phase group** — apply when consecutive phases are mutually dependent and none produces an isolated functional state. Example: a phase that defines types and another that implements them may be committed together. Group at most 2–3 phases per commit.

**Commit of the full plan** — exceptional scenario. Apply only when the entire plan is pure bootstrapping (initial scaffolding with no testable logic) or when all phases are so coupled that none is valid without the others. Justify in the commit body.

When marking a phase as `completed`, explicitly record in the plan which strategy was adopted and the corresponding commit hash when applicable.
