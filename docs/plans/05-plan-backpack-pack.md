# Execution Plan - `@paradoxlab/backpack` II: Asset Pack build and loader

This plan follows the conventions described in [docs/plans/README.md](README.md).

## References

- [docs/plans/README.md](README.md)
- [CONTEXT.md](../../CONTEXT.md)
- [ADR 0003 - `@paradoxlab/backpack` generates Asset Packs](../adr/0003-backpack-absorbs-thinger-and-spriter.md)
- [ADR 0004 - Asset Pack format](../adr/0004-asset-pack-format.md)
- [done-03-plan-appearance.md](done-03-plan-appearance.md) and [done-04-plan-backpack-content-sprites.md](done-04-plan-backpack-content-sprites.md) (prerequisites)
- `../mapeditor/docs/research/spike-s4.md` (pack contents, coverage, compatibility cases, sizes and timings)
- `../mapeditor/spikes/s4-asset-pack/src/{build/compose.ts,build/build-pack.ts,load.ts,validate.ts,compat.ts}`

## Design decisions already made

- **Files by consumer (`pack.json`, `items.json`, `render.json`, `page-N.png`, per-category files later); columns in JSON; typed arrays and rich views from the loader; `sid → appearance` derived, not shipped**: see [ADR 0004](../adr/0004-asset-pack-format.md)
- **Composition and pack format live in `backpack`; rules come from `@paradoxlab/appearance`**: see [ADR 0003](../adr/0003-backpack-absorbs-thinger-and-spriter.md)
- **Atlas encoder and packer as in plan I; lossless always**: see [done-04-plan-backpack-content-sprites.md](done-04-plan-backpack-content-sprites.md)
- **S4 rules kept** (validated in the spike): stack order from DAT flags; empty sprite is frame 0; identical frames deduplicated by their layer sprite-id tuple; `opaque` only when every frame is opaque; grounds and borders packed first

---

## Phase 1 - Composed frames

**Objective:** Every item appearance becomes Composed frames with layers flattened, trimmed, and deduplicated.

**Status:** `not started`

### Deliverables

- `packages/backpack/src/compose.ts`: `composeAppearances(content, spr)` returning `{ appearances: ComposedAppearance[], images }`:
  - for each cid and each sprite index of the layout with `layers = 1` (`spriteIndex` from `@paradoxlab/appearance`), stack the layers' sprites
  - frame 0 = empty; dedupe by layer sprite-id tuple
  - `opaque` per appearance
  - priority tag (ground, border, other) for packing

### Tests

- `packages/backpack/src/compose.test.ts`: a two-layer item flattens with the top layer over the bottom; identical tuples share one frame; an all-transparent frame maps to 0; `opaque` false when one frame has a transparent pixel

### Validation

- `pnpm --filter @paradoxlab/backpack test:run` passes

---

## Phase 2 - Pack build

**Objective:** `buildPack` writes a complete Asset Pack in the ADR 0004 layout from DAT, SPR and OTB.

**Status:** `not started`

### Deliverables

- `packages/backpack/src/pack/types.ts`: `PackManifest` (`schema`, `client`, `dat`, `spr`, `lineage`, `pages`, `counts`), `RenderJson` (appearances and the frame table, both in columns as ADR 0004 requires; the frame table reuses `FrameColumns` from plan 4)
- `packages/backpack/src/pack/build-pack.ts`: `buildPack({ dat, spr, otb?, version })` returning in-memory files: compose, pack with priority (grounds and borders first) through the atlas packer, encode pages, write `pack.json`, `items.json` (content columns), `render.json`
- `packages/backpack/src/index.ts` exports `buildPack`

### Tests

- `packages/backpack/src/pack/build-pack.test.ts` (synthetic client): every file present; counts in the manifest match the files; every appearance frame index points inside the frame table; frame rectangles inside their page
- `packages/backpack/tests/pack.local.ts`: packs for 772, 860, 870, 960 and 1098 build without error

### Validation

- `pnpm --filter @paradoxlab/backpack test:run` passes
- The 772 pack contains 4,990 items (S4 parity)

---

## Phase 3 - Loader

**Objective:** Editor and engine load a pack in a browser worker into typed arrays, with rich per-item views, and reject an incompatible pack before downloading its pages.

**Status:** `not started`

### Deliverables

- `packages/backpack/src/load/load-pack.ts`: `loadPack(read: (path) => Promise<Uint8Array | string>, { parts })`:
  - reads `pack.json` first
  - `items.json` columns into typed arrays (`Uint16Array`/`Uint32Array`/`Int32Array`, names as `string[]`)
  - each `render.json` frame column into its own `Uint16Array`
  - builds `sidToAppearance: Uint32Array`
  - `parts` lets a server load only `items`
- views reuse `src/backpack-views.ts` from plan 4 (`viewContent`'s `items.get(sid)`, generalized to typed-array columns): `pack.items.get(sid)` returning an `ItemView` (identity, placement, gameplay, light, appearance) built on demand from the columns; `pack.appearances.get(index)`
- `packages/backpack/src/load/compat.ts`: `checkCompatibility(manifest, otbmHeader)` returning `ok | warn | error` (S4 rules: lineage match, newer minor warns, other major errors)
- `packages/backpack/src/load/readers.ts`: `urlReader(base)` (fetch) and, in `src/node-reader.ts` outside `/load`, `fsReader(dir)`

### Tests

- `packages/backpack/src/load/load-pack.test.ts`: a synthetic pack loads; `items.get` returns the expected view; unknown sid returns `undefined`; `parts: ['items']` never reads `render.json` or pages
- `packages/backpack/src/load/compat.test.ts`: the three S4 compatibility cases
- `packages/backpack/tests/load.local.ts`:
  - every sid used by `small-acceptance-otbm1-otb1-3` resolves to an appearance in the 772 pack (S4 coverage test)
  - 7.72 map with the 772 pack: `ok`; 8.60 map with the 772 pack: `error`; distro map with the 870 pack: `warn`

### Validation

- `pnpm --filter @paradoxlab/backpack test:run` passes, including `no-node.test.ts`

---

## Phase 4 - CLI build

**Objective:** `backpack build` produces a pack directory from client files.

**Status:** `not started`

### Deliverables

- `backpack build --dat --spr --otb? --version --out` in `src/cli.ts`, writing the files from `buildPack` and printing counts, sizes and time

### Validation

- With local fixtures, `backpack build` for 1098 writes `pack.json`, `items.json`, `render.json` and the pages, and `loadPack(fsReader(out))` loads them

---

## Phase 5 - Performance validation

**Objective:** Pack generation and loading are measured on every client and compared with S4 and with the targets.

**Status:** `not started`

### Deliverables

- `packages/backpack/tests/pack.bench.local.ts`: for 772, 860, 870, 960 and 1098, best of 3 for:
  - build time
  - total size and size per file
  - page count and pixels
  - `loadPack` time and heap from `fsReader` (parse plus typed arrays)
- `packages/backpack/results/perf.md` with the table next to S4 (`spike-s4.md`: generation 0.9-2.5 s, 12.5-28.8 MB without page filters) and the decisions' targets:
  - build no slower than S4 by more than 10%
  - pages smaller than S4's unfiltered PNGs
  - `loadPack` of the 1098 pack JSON (items and render) ≤ 50 ms in Node

### Validation

- `results/perf.md` shows each target met, or each miss with its justification

---

## Phase 6 - Examples, README and release

**Objective:** The pack is documented by running examples, and the package is ready to publish.

**Status:** `not started`

### Deliverables

- `examples/pack-build.ts` and `examples/pack-load.ts` (`items.get`, drawing coordinates of a stack of 7 gold coins via `stackablePatterns` and `spriteIndex`), run in `examples/examples.test.ts` against a synthetic client
- `packages/backpack/README.md`: the four entry points, the CLI, the pack files (from the examples)
- `docs/SCHEMAS.md`: Asset Pack section (`pack.json`, `items.json`, `render.json`)
- Changeset: `@paradoxlab/backpack` minor

### Validation

- `pnpm test:run`, `pnpm check`, `pnpm typecheck`, `pnpm knip`, `pnpm circular` and `pnpm attw` pass
