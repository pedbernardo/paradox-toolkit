# PNPM quick reference

This guide covers the pnpm commands and concepts you'll use day-to-day in this project. The focus is practical: what to run, where to run it, and why it behaves differently from a plain npm project.

---

## Why pnpm?

pnpm solves two problems that npm and yarn have in monorepos:

1. **Shared dependencies are not duplicated** — pnpm maintains a global store and creates symlinks. If six packages use `typescript`, it is downloaded once.
2. **Native workspaces** — pnpm understands the `packages/*` structure and lets you run commands across all workspaces at once or target a specific one via `--filter`.

---

## Core concepts

### Workspace

The entire monorepo is a single pnpm workspace. The `pnpm-workspace.yaml` file at the root defines which folders are included:

```yaml
packages:
  - 'packages/*'
```

Each folder inside `packages/` is a **workspace package** with its own `package.json`.

### Catalog

`pnpm-workspace.yaml` also defines a `catalog` — a central list of dependency versions:

```yaml
catalogs:
  default:
    typescript: ^6.0.3
    vitest: ^4.1.8
    tsup: ^8.5.1
```

In individual `package.json` files, instead of repeating the version, use `catalog:`:

```json
"devDependencies": {
  "typescript": "catalog:",
  "vitest": "catalog:"
}
```

**Why this matters:** every package uses exactly the same version of each tool. There is no risk of one package using `vitest` 3 and another using `vitest` 4 by accident.

### workspace:\*

Internal packages reference each other with `workspace:*`:

```json
"dependencies": {
  "@paradoxlab/spr": "workspace:*",
  "@paradoxlab/dat": "workspace:*"
}
```

pnpm resolves this as a local symlink — no npm publish, no file copying. Changing `packages/spr/src/spr.ts` is immediately visible in `packages/spriter`, which depends on `@paradoxlab/spr`.

---

## Installing dependencies

### Golden rule

> **Never edit `package.json` manually to add dependencies.** Always use `pnpm add` to get the latest version and keep the lockfile consistent.

### Install everything (after cloning)

```bash
pnpm install
```

Run at the root. Installs dependencies for all workspaces at once.

### Add a dependency to a specific package

```bash
# Production dependency
pnpm add zod --filter @paradoxlab/otbm

# Development dependency
pnpm add -D @types/node --filter @paradoxlab/spr

# Multiple packages at once
pnpm add -D vitest --filter @paradoxlab/dat --filter @paradoxlab/otb
```

`--filter` accepts the `name` from `package.json` (`@paradoxlab/dat`) or a relative path (`./packages/dat`).

### Add a dependency at the monorepo root

Use `-w` (workspace root) for tooling dependencies that apply to the entire monorepo:

```bash
pnpm add -D -w oxlint
pnpm add -D -w lefthook lint-staged
```

Without `-w`, pnpm refuses to add at the root — this is a safeguard against installing product dependencies in the wrong place.

### Add to the catalog

When a dependency will be used across multiple packages, add it to the catalog in `pnpm-workspace.yaml` first, then use `catalog:` in the individual `package.json` files.

### Remove a dependency

```bash
pnpm remove sharp --filter @paradoxlab/spriter
pnpm remove -D @types/node --filter @paradoxlab/spr
```

---

## Running scripts

### Across all workspaces

```bash
pnpm -r build        # build all packages (sequential, respects dependency order)
pnpm -r typecheck    # typecheck all packages
pnpm -r test:cov     # coverage for all packages
```

`-r` means "recursive" — walks all workspaces.

### In a specific workspace

```bash
pnpm --filter @paradoxlab/dat build
pnpm --filter @paradoxlab/otbm typecheck
pnpm --filter @paradoxlab/spr test:cov
```

### In a workspace and its local dependencies

```bash
pnpm --filter @paradoxlab/spriter... build
```

The `...` includes the packages that `@paradoxlab/spriter` depends on (`@paradoxlab/spr`). Useful when you want to guarantee the full chain is built.

### At the root (scripts from the root `package.json`)

```bash
pnpm build        # build all packages
pnpm typecheck    # tsc --noEmit across all packages
pnpm test         # vitest in watch mode
pnpm test:run     # vitest run (single pass)
pnpm coverage     # coverage across all packages
pnpm lint         # oxlint across the entire monorepo
pnpm format       # oxfmt across the entire monorepo (modifies files)
pnpm check        # lint + format check without modifying (used in CI)
pnpm knip         # detect unused exports, dependencies, and files
pnpm circular     # detect circular dependencies between packages
pnpm attw         # verify exported types are correct (warn-only)
```

---

## How to: local and bench tests

Some packages have two additional scripts that are never run in CI.

### `test:local` — fixture-dependent integration tests

Packages that have a `tests/` directory (`dat`, `spr`, `otb`, `otbm`) expose a `test:local` script that runs `tests/**/*.local.ts` files via a separate vitest config. These tests require Tibia binary fixtures that are not committed to the repository.

```bash
pnpm --filter @paradoxlab/dat test:local
pnpm --filter @paradoxlab/spr test:local
pnpm --filter @paradoxlab/otb test:local
pnpm --filter @paradoxlab/otbm test:local
```

Tests that find no fixture file skip automatically (`it.skipIf` / `describe.skipIf`), so the command never fails outright — it just produces skipped tests for every missing file.

### `bench` — performance benchmarks

`@paradoxlab/spr` and `@paradoxlab/otbm` expose a `bench` script that runs a standalone benchmark file with Node directly:

```bash
pnpm --filter @paradoxlab/spr bench
pnpm --filter @paradoxlab/otbm bench     # allocates up to 8 GB — large map files
```

Both commands also require fixture files to produce meaningful output. Without them the benchmark will either skip or error.

---

## `node_modules` structure

In pnpm, `node_modules` works differently from npm:

- Each package has its own `node_modules` with symlinks
- The actual files live in a global store (`~/.pnpm-store`)
- You **cannot** import a dependency that is not declared in the package's own `package.json` — pnpm isolates packages from each other (unlike npm, where silent hoisting allowed this)

**Practical consequence:** if an import breaks with "cannot find module", check that the dependency is declared in the correct `package.json`, not just in the root.

---

## Updating dependencies

```bash
# See what is outdated
pnpm outdated -r

# Update a specific dependency in one package
pnpm update sharp --filter @paradoxlab/spriter

# Update the catalog (edit pnpm-workspace.yaml, then run)
pnpm install
```

To update catalog versions, edit `pnpm-workspace.yaml` directly and run `pnpm install`.

---

## How to: publish

Packages in this monorepo are published to npm as `@paradoxlab/*`. The process uses [Changesets](https://github.com/changesets/changesets) to manage versions and changelogs in a coordinated way. There is no automated publish via CI — everything is done manually by the maintainer.

### Full flow

```
pnpm changeset   →   pnpm version   →   pnpm build   →   pnpm release
```

### Step by step

**1. Create a changeset**

After making changes to packages, document what changed:

```bash
pnpm changeset
```

The CLI asks which packages were affected and what kind of change it is (`patch`, `minor`, or `major`). This generates a file in `.changeset/` describing the bump.

Semver guide:
- `patch` — bug fix, no API change (`0.1.0 → 0.1.1`)
- `minor` — new backward-compatible functionality (`0.1.0 → 0.2.0`)
- `major` — breaking API change (`0.1.0 → 1.0.0`)

**2. Bump versions**

```bash
pnpm version
```

Consumes the files in `.changeset/`, updates the `version` fields in affected `package.json` files, and generates/updates each package's `CHANGELOG.md`. The changeset files are removed automatically.

Review the changes before continuing — this is the moment to adjust changelog messages if needed.

**3. Build the packages**

```bash
pnpm build
```

Ensures `dist/` is up to date with the code that will be published.

**4. Publish**

```bash
pnpm release
```

Runs `changeset publish`, which publishes to npm all packages whose `version` has not yet been published. The published name comes from each package's `publishConfig.name` (`@paradoxlab/*`).

> Requires active npm authentication. Run `npm login` first if needed.

**5. Commit and push**

```bash
git add .
git commit -m "chore: release"
git push
```

`changeset publish` creates git tags automatically (e.g. `@paradoxlab/dat@0.2.0`). No need to create tags manually.

---

## Common troubleshooting

### "Cannot find module '@paradoxlab/spr'"

The symlink was not created. Run `pnpm install` at the root.

### "This command is not allowed in the root workspace"

You ran `pnpm add` without `-w`. If it is a monorepo tooling dependency, add `-w`. If it is a package dependency, use `--filter`.

### Lockfile conflict in git

Always resolve `pnpm-lock.yaml` via merge — do not discard or regenerate it. After resolving the conflict, run `pnpm install` to validate.

### Dependency installed but not recognized by TypeScript

Check that the dependency is declared in the correct package's `package.json`. The `skipLibCheck: true` in `tsconfig.base.json` suppresses type errors inside dependencies but does not resolve missing imports.

### "pnpm release" publishes nothing

`changeset publish` only publishes packages whose version in `package.json` does not yet exist in the registry. If you skipped `pnpm version`, no new version was generated and the command does nothing.
