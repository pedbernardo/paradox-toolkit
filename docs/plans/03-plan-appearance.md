# Execution Plan - `@paradoxlab/appearance`: visual rules of DAT thing types

This plan follows the conventions described in [docs/plans/README.md](README.md).

## References

- [docs/plans/README.md](README.md)
- [CONTEXT.md](../../CONTEXT.md)
- [ADR 0003 - `@paradoxlab/backpack` generates Asset Packs](../adr/0003-backpack-absorbs-thinger-and-spriter.md)
- `../mapeditor/packages/appearance/src` (source to promote: `layout.ts`, `patterns.ts`, `elevation.ts`, `appearance.test.ts`)

## Design decisions already made

- **First-level package with zero dependencies; the rules describe DAT thing types, not packs**: see [ADR 0003](../adr/0003-backpack-absorbs-thinger-and-spriter.md) (consequences)

---

## Phase 1 - Package and rules

**Objective:** `@paradoxlab/appearance` publishes the sprite index, pattern, elevation and animation-phase rules with the same behavior as the editor's package.

**Status:** `not started`

### Deliverables

- `packages/appearance/` with `package.json` (`sideEffects: false`, no dependencies), `tsup.config.ts`, `vitest.config.ts`, `tsconfig.json`, following the other packages
- `packages/appearance/src/types.ts`: `SpriteLayout`, `SpriteCoordinates`, `Patterns`, `Hook`
- `packages/appearance/src/layout.ts`: `TILE_PIXELS`, `spriteIndex`, `partOffset`
- `packages/appearance/src/patterns.ts`: `positionPatterns`, `stackablePatterns`, `fluidPatterns`, `hangablePatterns`
- `packages/appearance/src/elevation.ts`: `MAX_ELEVATION`, `accumulateElevation`, `LEGACY_PHASE_MS`, `legacyAnimationPhase`
- `packages/appearance/src/index.ts` re-exporting functions and types (types from `types.ts`)

### Tests

- `packages/appearance/src/layout.test.ts`, `patterns.test.ts`, `elevation.test.ts`: the editor's `appearance.test.ts` cases split by module, plus the stackable boundaries (4/5, 9/10, 24/25, 49/50) and hooks on layouts without the pattern

### Validation

- `pnpm --filter @paradoxlab/appearance test:run` passes with the package coverage thresholds
- `pnpm circular` shows no dependency from `appearance`

---

## Phase 2 - README and release

**Objective:** The package is documented and ready to publish.

**Status:** `not started`

### Deliverables

- `packages/appearance/README.md`: what each rule is, with the otclient function it mirrors
- Changeset: `@paradoxlab/appearance` 0.1.0
- `CLAUDE.md` package graph updated with `appearance`

### Validation

- `pnpm check`, `pnpm knip` and `pnpm attw` pass
