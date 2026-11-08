# Execution Plan - `@paradoxlab/backpack` I: package, item content and sprite atlas

This plan follows the conventions described in [docs/plans/README.md](README.md).

## References

- [docs/plans/README.md](README.md)
- [CONTEXT.md](../../CONTEXT.md)
- [ADR 0003 - `@paradoxlab/backpack` generates Asset Packs and absorbs `thinger` and `spriter`](../adr/0003-backpack-absorbs-thinger-and-spriter.md)
- [ADR 0004 - Asset Pack format](../adr/0004-asset-pack-format.md)
- [ADR 0002 - Text codec per file](../adr/0002-text-codec-per-file.md)
- [done-01-plan-foundation-utils-fixtures.md](done-01-plan-foundation-utils-fixtures.md) (prerequisite: fixtures, codecs)
- `packages/thinger/src` and `packages/spriter/src` (code being absorbed)
- `../mapeditor/docs/research/spike-s4.md` (sizes and timings to beat); `../mapeditor/spikes/s4-asset-pack/src/build/{trim,pack-pages,png}.ts`

## Design decisions already made

- **One package, four entry points (`.`, `/load`, `/content`, `/sprites`), CLI `backpack`; `thinger` and `spriter` removed without a deprecation path**: see [ADR 0003](../adr/0003-backpack-absorbs-thinger-and-spriter.md)
- **Items by sid (never invented), appearances by cid, lineage explicit (`null` = no OTB, sid = cid declared); columns in JSON, rich views in the loader**: see [ADR 0004](../adr/0004-asset-pack-format.md)
- **Sprite atlas** (decided in the v0.02 grill): `.spr` only; several pages with `maxPageSize` 4096; optional `ids` subset; optional trimming (off by default); configurable padding; own PNG encoder without `sharp` (row filters over deflate, Node and browser); per-sprite extraction; lossless always (no palette, no KTX2/Basis); WebP deferred; binary alpha

## As built

The phases below keep their original deliverables; where the code differs, this section wins.

- **Entry points:** `.`, `/content` and `/sprites` only. `/load` moves to plan 5, which is where its first code lands; `@paradoxlab/appearance` and `@paradoxlab/utils` are not dependencies yet (knip).
- **File layout:** flat `src/backpack-*.ts` modules (`backpack-content`, `backpack-png`, `backpack-atlas`, `backpack-sprites`, `backpack-node`, `backpack-views`), not `src/content/` and `src/sprites/` folders; entry files `src/content.ts` and `src/sprites.ts`.
- **Content columns:** `ItemFlag` has no `BlocksSight` bit: the old mapper filled it from the same flag as `BlocksMissile`, and no client file tells them apart. Gameplay keeps every field the old mapper produced (`floorChange`, `weight`, writable lengths, `rotateTo`, `lensHelp`, …); visual fields (`order`, `elevation`, offset, light, sprites) live in the appearance columns by cid, not per item. No `toColumns`/`fromColumns`: `buildContent` writes columns directly.
- **Views:** `viewContent(content).items.get(sid)` and `viewFrames(frames).get(spriteId)` read the columns on demand through one `Int32Array` index, the same `items.get(sid)` shape ADR 0004 gives the loader (10.98: index 1.6 ms; see `results/perf.md`).
- **Atlas:** one shelf packer for trimmed and untrimmed sprites (no grid special case); pages are drawn one at a time by `renderPage`.
- **PNG:** `encodePng(rgba, width, height, deflate)`; `deflateNode` (root entry) and `deflateWeb` (over `CompressionStream`, in `/sprites`) live in `backpack-png.ts` and `backpack-node.ts`, not in separate `deflate-*` files.
- **I/O:** `backpack-node.ts` throws `Error("<kind> file not found: <path>")`; the CLI catches and exits 1. Covered by the CLI and local tests rather than an `io.test.ts`.
- **Phase 6:** `thinger` and `spriter` are removed from the workspace as ADR 0003 decided; their source is kept in `references/` (git-ignored) for consultation until it is deleted. `sharp` leaves the catalog and the build allow-lists. The old `content.json` 1.0.0 and `positions.json` sections leave `docs/SCHEMAS.md`.
- **Performance:** `bench:sprites` compared against spriter 0.2 on four clients before its removal (`results/perf.md`): 2-2.5x faster, same or smaller PNGs, pages ≤ 4096 px, lossless.
- **Follow-up:** `@paradoxlab/spr` caches every decoded sprite (≈ 1.4 GB on the 1098); bounding it is a change to `spr`.
- **Commit strategy:** commit of the full plan after the maintainer's review, split into code, changesets and docs.

---

## Phase 1 - Package scaffold

**Objective:** `@paradoxlab/backpack` builds four entry points and a `backpack` binary, with no feature yet.

**Status:** `completed`

### Deliverables

- `packages/backpack/package.json`: exports `.`, `./load`, `./content`, `./sprites` (each `import` + `types`), `bin.backpack`, `sideEffects: false`, dependencies `@paradoxlab/appearance`, `dat`, `spr`, `otb`, `utils`, `commander`
- `packages/backpack/tsup.config.ts` with the four entries plus `src/cli.ts`
- `packages/backpack/src/{index,load/index,content/index,sprites/index}.ts` and `src/types.ts`
- `packages/backpack/src/load/no-node.test.ts`: fails if anything under `src/load` imports `node:*` or another `@paradoxlab/*` package except `appearance`

### Validation

- `pnpm --filter @paradoxlab/backpack build` produces four entry files and `cli.js`
- `pnpm attw` reports the four subpaths resolvable

---

## Phase 2 - Item content by sid

**Objective:** `/content` turns a DAT and an OTB into one item per sid and one raw appearance per cid, with no sid lost or invented.

**Status:** `completed`

### Deliverables

- `packages/backpack/src/content/types.ts` (re-exported through `src/types.ts`): `ContentMeta` (`schema`, `client`, `dat`, `spr`, `lineage: { otbMajor, otbMinor } | null`), `ItemColumns` (`sid`, `cid`, `name`, `order`, `elevation`, `flags` bitmask, `groundSpeed`, `light`, `minimapColor`, `appearance`, plus hangable and hooks as flag bits), `ItemFlag` bit constants, `RawAppearance` (`cid`, `layout` with `layers`, `spriteIds`, `offset`, `light`)
- `packages/backpack/src/content/build-content.ts`: `buildContent({ dat, otb })`:
  - one item per OTB entry; gameplay from OTB flags with DAT fallback (as `thinger-mapper.ts` did)
  - name from OTB, then `name-map.json` (moved from `thinger/src/resources`)
  - `appearance` = index of the item's cid in the appearance list, `-1` when the client has no thing
  - things without an OTB entry only as appearances
  - with `otb` absent: lineage `null`, one item per DAT item with sid = cid
- `packages/backpack/src/content/columns.ts`: `toColumns(items)` / `fromColumns(json)` (the JSON layout of ADR 0004)

### Tests

- `packages/backpack/src/content/build-content.test.ts` (synthetic DAT/OTB): two sids on one cid give two items and one appearance; a DAT item without OTB entry gives no item; no-OTB mode declares lineage `null`; flag bits round-trip through columns
- `packages/backpack/tests/content.local.ts`: per OTB fixture, item count equals the OTB entry count (4,990 for `otb1-3`, 25,548 for `otb3-57`); distinct cids equal the appearance count

### Validation

- `pnpm --filter @paradoxlab/backpack test:run` passes
- The local test shows zero lost sids on every OTB fixture (the measurement that found up to 1,922 lost by `thinger`)

---

## Phase 3 - PNG encoder

**Objective:** The toolkit encodes RGBA pages to lossless PNG without native dependencies, in Node and in the browser.

**Status:** `completed`

### Deliverables

- `packages/backpack/src/sprites/png.ts`: `encodePng(rgba, width, height, { deflate })`:
  - per-row filter choice (none, sub, up, average, Paeth) by minimum sum of absolute differences
  - CRC32 and the `IHDR`/`IDAT`/`IEND` chunks
  - `deflate` injected: `node:zlib` `deflateSync` in Node (`src/sprites/deflate-node.ts`), `CompressionStream('deflate')` in the browser (`src/sprites/deflate-web.ts`)

### Tests

- `packages/backpack/src/sprites/png.test.ts`: encode then decode with `node:zlib` inflate and a minimal PNG reader gives the same pixels for random RGBA; every filter type is exercised; partial alpha survives
- Property test: arbitrary small RGBA images round-trip pixel for pixel

### Validation

- `pnpm --filter @paradoxlab/backpack test:run` passes
- The package's dependency tree has no native module (`pnpm why sharp` empty)

---

## Phase 4 - Sprite atlas and extraction

**Objective:** `/sprites` packs the sprites of a `.spr` into pages that fit GPU textures, and extracts single sprites.

**Status:** `completed`

### Deliverables

- `packages/backpack/src/sprites/atlas.ts`: `packSprites(spr, { ids?, maxPageSize = 4096, padding = 1, trim = false, order? })` returning `{ pages: { width, height, rgba }[], frames }`:
  - grid packing without trimming
  - shelf packing with trimming; frames carry page, x, y, w, h and trim offset
  - pages cut to content height
- `packages/backpack/src/sprites/sprite-sheet.ts`: `buildSpriteSheet(...)` returning encoded pages plus `SpriteSheetJson` (schema 2.0.0: `meta`, `pages`, `frames` in columns by sprite id)
- `packages/backpack/src/sprites/extract.ts`: `extractSprites(spr, ids)` yielding `{ id, png }`

### Tests

- `packages/backpack/src/sprites/atlas.test.ts`: frames never overlap; padding respected; a set larger than one page spills to a second page; trimming shrinks a sprite with transparent borders and records the offset; `ids` limits the output
- `packages/backpack/tests/sprites.local.ts`: 772 and 1098 clients; every page ≤ 4096 × 4096; reading pixels back from the decoded pages through `frames` equals the source sprites

### Validation

- `pnpm --filter @paradoxlab/backpack test:run` passes
- For the 1098 client, the sheet of all sprites spans several pages none above 4096 px (0.2 produced one 4091 × 90,221 sheet)

---

## Phase 5 - CLI for content and sprites

**Objective:** `backpack content` and `backpack sprites` replace the `thinger` and `spriter` binaries.

**Status:** `completed`

### Deliverables

- `packages/backpack/src/cli.ts` (commander):
  - `backpack content --dat --otb? --version --out`
  - `backpack sprites --spr --version --out [--ids] [--trim] [--max-page-size]`
  - `backpack extract --spr --version --ids --out`
  - errors via `console.error` + `process.exit(1)`
- `packages/backpack/src/io.ts`: file loading and writing helpers (from `thinger-io.ts` and `spriter-io.ts`)

### Tests

- `packages/backpack/src/io.test.ts`: missing files and invalid inputs return typed failures

### Validation

- With local fixtures, `pnpm --filter @paradoxlab/backpack exec backpack sprites --spr <1098> --version 1098 --out tmp` writes pages and the sheet JSON; `backpack content` writes the content JSON

---

## Phase 6 - Remove `thinger` and `spriter`

**Objective:** The repository has one asset tool, and its docs describe it.

**Status:** `completed`

### Deliverables

- `packages/thinger/` and `packages/spriter/` deleted; `sharp` removed from the catalog, `allowBuilds` and `onlyBuiltDependencies`
- `docs/SCHEMAS.md` rewritten for the content JSON and the sprite sheet JSON 2.0.0
- `CLAUDE.md` package graph updated (`backpack → appearance, dat, spr, otb → utils`)
- Changeset: `@paradoxlab/backpack` 0.1.0

### Validation

- `pnpm install`, `pnpm build`, `pnpm test:run`, `pnpm knip`, `pnpm circular` pass
- `grep -rn "thinger\|spriter" packages docs/SCHEMAS.md CLAUDE.md` returns nothing outside changelogs
