# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Docs & guidelines

- [docs/PNPM.md](docs/PNPM.md) - pnpm workspaces, catalog usage, and publish flow
- [docs/SCHEMAS.md](docs/SCHEMAS.md) - `content.json` and `positions.json` schema reference
- [docs/plans/README.md](docs/plans/README.md) - plan naming, lifecycle, phase structure, commit strategy

## Commands

```bash
pnpm install                          # install all workspace deps
pnpm build                            # build all packages (tsup)
pnpm typecheck                        # tsc --noEmit across all packages
pnpm test                             # vitest watch
pnpm test:run                         # vitest run (single pass)
pnpm coverage                         # coverage across all packages
pnpm check                            # oxfmt --check + oxlint (CI gate)
pnpm format                           # oxfmt (write)
pnpm lint                             # oxlint
pnpm knip                             # detect unused exports, deps, files
pnpm circular                         # detect circular deps between packages
pnpm attw                             # verify exported types (warn-only)

# Per-package
pnpm --filter @paradox/dat typecheck
pnpm --filter @paradox/otbm test:cov

# Release (manual - no CI publish)
pnpm changeset                        # document what changed
pnpm version                          # bump versions + update CHANGELOGs
pnpm build                            # rebuild after version bump
pnpm release                          # publish to npm as @paradoxlab/*
```

Git hooks (Lefthook): pre-commit runs `lint-staged` (oxfmt + oxlint --fix on staged `.ts/.json`). commit-msg runs `commitlint`. Commits must follow Conventional Commits.

### Commit conventions

- **Language:** subject and body always in English.
- **Types:** `feat`, `fix`, `refactor`, `style`, `chore`, `docs`, `test`.
- **Scope:** use the package name - `feat(dat):`, `fix(otbm):`, `chore(utils):`. Use no scope for monorepo-wide changes.
- **No Co-Authored-By lines.** Never add `Co-Authored-By: Claude` to commits.
- **Never mix concerns.** `.md` files alongside `.ts` files require two commits: one `feat`/`fix`/`refactor` for code, one `docs` for markdown.

## Architecture

### Package graph

```
@paradox/spriter   → @paradox/spr
@paradox/thinger   → @paradox/dat, @paradox/otb
@paradox/dat       → @paradox/utils
@paradox/spr       → @paradox/utils
@paradox/otb       → @paradox/utils
@paradox/otbm      → @paradox/utils
@paradox/utils     → (none)
```

`@paradox/spriter` and `@paradox/thinger` are build tools (CLI + API). The other five are pure parsers/writers.

### Internal name vs. published name

Packages use `@paradox/*` for internal `workspace:*` references. Published to npm as `@paradoxlab/*` via `publishConfig.name` in each `package.json`.

### Package anatomy

Every package follows this structure:

```
src/
  index.ts          # single public surface - re-exports everything consumers need
  types.ts          # all public types live here; implementation files import from types.ts
  <name>.ts         # main factory/implementation
  <name>-*.ts       # sub-modules (config, writer, attributes, flags…)
  *.test.ts         # unit tests - run in CI via vitest
tests/
  *.local.ts        # integration tests - require binary fixtures, never run in CI
fixtures/           # binary test files (not committed - Tibia client files)
```

### Factory pattern

All parsers and build tools expose a factory function that returns a typed object:

```ts
// Factory creates the parser/writer with optional configuration
const parser = Dat(772)           // or Dat() for auto-detect
const file = parser.load(buffer)  // parse
const bin = parser.write(file)    // serialize

// Validate without loading
parser.validate(buffer)           // throws ParseError on mismatch

// Streaming write (otbm)
for await (const chunk of Otbm().writeStream(data)) { ... }
```

Factories for build tools:

```ts
const content = Thinger({ dat: datFile, otb: otbFile }).build()
const sheet = await Spriter({ spr: sprFile, maxWidth: 4096 }).build()
```

### Version support

Supported client versions: `710, 740, 750, 755, 760, 770, 772, 860, 870, 960, 980, 1098`.

`getVersionFeatures(version)` from `@paradox/utils` returns the feature flags for a given version and throws `UnsupportedVersionError` for anything outside this list.

### Error model

- `ParseError` - malformed or unexpected binary data. Thrown by all parsers.
- `UnsupportedVersionError` - version not in the supported list.
- Both are exported from `@paradox/utils` and re-exported by each package's `index.ts`.
- CLI boundaries (`spriter` CLI) catch errors and exit via `console.error + process.exit(1)`, not re-throw.

---

## Invariants

Rules with no exceptions.

- **`types.ts` is the canonical home for all public types.** Implementation files never define exported types inline - they import from `./types.js`. `index.ts` re-exports types from `types.ts`, not from implementation files.
- **`index.ts` is the only public surface.** External consumers import from the package root. Internal cross-file imports use direct paths; only `index.ts` assembles the public API.
- **`tests/*.local.ts` files are never included in CI.** Vitest `include` only picks up `src/**/*.test.ts` and `tests/**/*.spec.ts`. Files named `*.local.ts` require binary fixtures that are not committed to the repository.
- **No proprietary binary fixtures committed.** client files (`.dat`, `.spr`) are not in the repository. Tests that require them live in `tests/*.local.ts`.
- **`sideEffects: false`** is set in every library package's `package.json` to enable tree-shaking.
- **All files are in English.** Code, comments, docs, plan files, ADRs.
- **No automated publish.** The release workflow does not exist. All publishes are manual via `pnpm release` by the maintainer.

---

## Patterns

### Types

Public types belong in `types.ts`. The implementation file imports them and re-exports what the public API exposes:

```ts
// types.ts
export type DatOptions = { strict?: boolean }
export type DatFile = { ... }

// dat.ts
import type { DatOptions, DatFile, ... } from './types.js'
export type { DatFile, DatOptions }   // re-export for index.ts

// index.ts
export { Dat } from './dat.js'
export type { DatFile, DatOptions, ... } from './types.js'  // always from types.ts
```

### Tests

Unit tests (`src/*.test.ts`) test logic without file I/O - use synthetic buffers built programmatically.

Local tests (`tests/*.local.ts`) test against real binary files and must guard with `it.skipIf(!hasFixture(...))` or `describe.skipIf(...)` so they degrade gracefully when fixtures are absent.

### Binary readers/writers

Always use `createBinaryReader` / `createBinaryWriter` from `@paradox/utils`. Never use `DataView` or manual byte manipulation in package-level code.

Module-level `TextDecoder` constants for hot paths:

```ts
const textDecoderLatin1 = new TextDecoder('latin1')  // not per-call
```
