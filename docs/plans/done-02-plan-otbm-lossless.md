# Execution Plan - `@paradoxlab/otbm` 0.3: lossless event reader and encoder

This plan follows the conventions described in [docs/plans/README.md](README.md).

## References

- [docs/plans/README.md](README.md)
- [CONTEXT.md](../../CONTEXT.md)
- [ADR 0001 - OTBM reader and encoder share one event contract](../adr/0001-otbm-symmetric-event-contract.md)
- [ADR 0002 - Strings are decoded with a per-file text codec](../adr/0002-text-codec-per-file.md)
- [done-01-plan-foundation-utils-fixtures.md](done-01-plan-foundation-utils-fixtures.md) (prerequisite: output buffer, codecs, fixtures, `inlineCountOf`)
- `../mapeditor/docs/research/spike-s5.md` (the 9 fixes, the 10 lessons, the performance numbers)
- `../mapeditor/spikes/s1-model/src/otbm/reader.ts` (reader engine to port)
- `../mapeditor/spikes/s5-otbm-write/src/writer.ts`, `map-document.ts`, `compare.ts` (writer, layout and comparator to port)

## Design decisions already made

- **Reader emits OTBM events; the Encoder consumes the same events; `read(bytes, encoder)` is a Byte-identical roundtrip**: see [ADR 0001](../adr/0001-otbm-symmetric-event-contract.md)
- **Events carry the full Shape; attributes as an immutable ordered list; positional arguments on hot events, objects on rare ones; push visitor**: see [ADR 0001](../adr/0001-otbm-symmetric-event-contract.md)
- **sid only; `OtbLookup` and `cid` removed; v1 takes `hasInlineCount`**: see [ADR 0001](../adr/0001-otbm-symmetric-event-contract.md)
- **Preserve, never repair; tolerant by default with diagnostics, `strict` option; encoder always strict**: see [ADR 0001](../adr/0001-otbm-symmetric-event-contract.md)
- **Upgrades only for version conversion**: see [ADR 0001](../adr/0001-otbm-symmetric-event-contract.md)
- **Text codec option on reader and encoder**: see [ADR 0002](../adr/0002-text-codec-per-file.md)
- **Ceilings** (v0.02 grill, revised during execution): reference `OTBM_LARGEST_KNOWN` = 110 MB; file warning (diagnostic) above 2× (220 MB), fatal above 3× (330 MB); fatal ceilings for items per tile (1,024), children per container (1,024), item nesting (32) and node property bytes (1 MB). The warning levels per tile and per node and the map statistics of the grill table were dropped: they cost counters in the hot loop for signals the consumer computes on its own
- **Performance targets in Node** (v0.02 grill, `load` revised during execution), on medium, large, xlarge and stress: `read` with an empty visitor ≤ 1.0 s on the xlarge; `writeStream(otbm.source(bytes))` ≤ 2.5 s on the xlarge and ≤ 1 s on the large; extra memory of `writeStream` ≤ 32 MB on any map; `load` no slower than 0.2, heap measured (the grill's ≤ 4 s had no reference: `load` is an object model, like model A of S1); a regression above 10% on any target needs a written justification or the phase does not close

## Execution notes (whole plan)

**The reader and the encoder were rebuilt halfway through.** The first version of Phases 2-4 was written anew and measured only in Phase 9, through a harness that also loaded a whole document in every process; it looked 1.5-1.8× slower than the S1 reader. Phase 9 stopped there. The reader was rebuilt from the 0.2 structure, measured after every step; the writer was rebuilt from the 0.2 writer's layout (one function per node). The step-by-step costs are in `packages/otbm/results/perf.md`.

**Module map** (`otbm-*` names, as the package convention asks; reorganized after review):
- `otbm.ts`: factory; `read` takes one visitor or a list, called in order for each event
- `otbm-config.ts`: constants, limits and the limit functions
- `otbm-attributes.ts`: one symmetric table, read and write per attribute
- `otbm-stream.ts`: reader (`OtbmStreamParser`) with its diagnostic log
- `otbm-writer.ts`: encoder
- `otbm-document.ts`: collect and replay objects
- `otbm-layout.ts`: collect the Source layout and compose a model back into it
- `otbm-upgrade.ts`, `otbm-compare.ts`
- `types.ts`: every public type
- `tests/support/`: test-only code (byte builders, event recorder and tile source over a document, fast-check arbitraries, fixture loading), so nothing test-only sits in `src/` and coverage needs no exclusions

**What changed against the deliverables below:**
- **Diagnostics:** 7 codes (`file-above-reference`, `node-out-of-place`, `tile-outside-area`, `unknown-node`, `area-properties-extra`, `trailing-bytes`, `possible-utf8-text`). Each is reported once at the end as `{ code, offset, count, message }`; there is no severity and no `strict` option.
- **Two Shape facts found in the fixtures** joined the contract: the 4 bytes before the root (`header.identifier`) and the bytes after the root node (`end(trailing)`, 1 byte in `large-small-areas`). `mapDataEnd` was added for maps with nodes after the map data.
- **`large-small-areas` is malformed** further than S5 described. An area closes early and every later area sits under the root: 205 thousand areas. Self-contained nodes out of place are read in place, so its 3.3 million tiles are seen and the file still comes back byte for byte.
- **`OtbmDocumentItem.children`** is `null` when empty (12 million empty arrays otherwise).
- **Bench:** `bench/otbm.bench.ts` runs each cell in its own process, best of 5. The fixtures helper and the examples package are workspace packages (`fixtures/`, `examples/`).
- **Validation reached:**
  - 12 of 12 fixtures byte-identical through `write(source)`, `write(load)` and the composer;
  - 3 v1 fixtures upgraded to v3 with no semantic difference;
  - property tests over 800 random maps;
  - coverage of 96.7% of statements and 93.9% of branches.

---

## Phase 1 - Event vocabulary and public types

**Objective:** The package's public contract (events, attributes, diagnostics, limits, sources) exists as types and compiles, with no implementation yet.

**Status:** `completed`. Commit of the full plan (reviewed as a whole): `5f7e1db` (utils), `7ad4aa2` (otbm), `d76c2b8` (examples), `5da20ea` (changeset), followed by a `docs` commit.

**As built** (where it departs from the deliverables below):
- **The 0.2 code moved to `src/legacy/`** (`otbm.ts`, `otbm-stream.ts`, `otbm-attributes.ts`, `otbm-writer.ts`, `types.ts`, their tests and the bench), out of `index.ts`. `tests/*.spec.ts` and `tests/*.local.ts` import it from there until Phase 10. `otbm-config.ts` stays in `src/`, shared, and gains the map-data attributes `SPAWN_FILE` (0x0b) and `HOUSE_FILE` (0x0d).
- **Every known node keeps a `tail`**, not only tiles and items: header, area, town and waypoint, for extra property bytes such as the 12-byte area of `large-small-areas`.
- **`OtbmMapData` is an ordered attribute list**, like items, so the order of descriptions and of the spawn and house files survives.
- **`tile` receives `flags: number | null`:** an explicit flags attribute with value 0 differs from no attribute.
- **Unknown nodes are emitted as their verbatim bytes** (`unknownNode(type, raw)`, from node start to node end, children included). There is no `unknownNodeEnd`, and nothing inside an unknown node is interpreted.
- **Diagnostics are a visitor event** (`diagnostic`), not an `onDiagnostic` option: one channel, which the object document can collect.
- **Every visitor method is optional,** so a consumer implements only what it needs; the encoder implements them all.
- **`ATTRIBUTE_MAP` (0x80) has no member of its own.** It is kept losslessly as the `unknown` tail, as in S1; parsing it can come later.
- **`SourceLayout` keeps only the position of the town and waypoint lists** (`{ kind: 'list' }`). Their contents come from the consumer's model, which can edit them.

### Deliverables

- `packages/otbm/src/types.ts` rewritten:
  - `OtbmHeader` (`version`, `width`, `height`, `otbMajor`, `otbMinor`, `rootType`)
  - `OtbmMapData` (`descriptions`, `spawnFile`, `houseFile`, `tail`)
  - `ItemForm` (`'node' | 'inline' | 'node+inlineCount'`)
  - `OtbmItemAttribute`: discriminated union, one member per known attribute (action id, unique id, text, description, teleport, depot id, rune charges, house door id, count, duration, decay state, written date, written by, sleeper guid, sleep start, charges, attribute map) plus `{ kind: 'unknown', bytes }`
  - `OtbmVisitor`: `header`, `mapData`, `area`, `areaEnd`, `tile(x, y, z, flags, houseId, tail)`, `tileEnd`, `item(sid, form, attributes)`, `itemEnd`, `list(kind)`, `listEnd`, `town`, `waypoint`, `unknownNode(type, props)`, `unknownNodeEnd`, `diagnostic`
  - `OtbmDiagnostic` (`code`, `severity: 'info' | 'warning' | 'error'`, `offset`, `detail`) and the code list
  - `OtbmLimits`, `OtbmOptions` (`text`, `hasInlineCount`, `strict`, `limits`, `onDiagnostic`)
  - `OtbmSource` (`emit(visitor): Iterable<void>`), `OtbmTileSource`, `SourceLayout`
- `packages/otbm/src/limits.ts`: `OTBM_LARGEST_KNOWN`, `OTBM_HEADROOM`, `DEFAULT_OTBM_LIMITS`
- `packages/otbm/src/otbm-config.ts`: node types, attribute ids, map-data attribute ids (from S1)
- The 0.2 implementation files (`otbm-stream.ts`, `otbm-attributes.ts`, `otbm-writer.ts`) moved aside to be deleted in Phase 10, not exported

### Validation

- `pnpm --filter @paradoxlab/otbm typecheck` passes with the new `types.ts`
- `index.ts` exports only types from `types.ts` and the constants from `limits.ts`

---

## Phase 2 - Event reader

**Objective:** `read(bytes, visitor)` reports every node of every fixture in file order with its full Shape, allocating nothing per tile or per item without attributes.

**Status:** `completed`. Commit of the full plan (reviewed as a whole): `5f7e1db` (utils), `7ad4aa2` (otbm), `d76c2b8` (examples), `5da20ea` (changeset), followed by a `docs` commit.

### Deliverables

- `packages/otbm/src/reader.ts`: `readOtbm(bytes, visitor, options)` ported from the S1 engine (single pass, reused unescape scratch, explicit node stack):
  - root node type, header, map data with tail
  - areas, tiles and house tiles (house id 0 kept as a house tile), tile tails
  - inline tile items as `item(sid, 'inline', null)`; v1 count byte as `'node+inlineCount'` using `hasInlineCount`
  - item attributes in file order, unknown tail as the last attribute
  - towns, waypoints, lists (even empty), unknown nodes at any depth
  - strings through the `text` codec
  - progress by bytes read (`onProgress(offset, total)`)
- OTBM v1 without `hasInlineCount` throws `ParseError` naming the missing option
- `packages/otbm/src/otbm.ts`: factory `Otbm(options)` with `validate(bytes)` and `read(bytes, visitor, { onProgress })`

### Tests

- `packages/otbm/src/reader.test.ts` (synthetic buffers): every node type; every attribute; inline vs node items; v1 inline count with and without the predicate; tile and item tails; unknown node inside an item and inside MAP_DATA; empty towns list; escaped bytes inside properties; strings in windows-1252 and windows-1250
- `packages/otbm/tests/reader.spec.ts`: the two public fixtures read with the expected tile, item, town and waypoint counts

### Validation

- `pnpm --filter @paradoxlab/otbm test:run` passes
- A local run over every fixture (`tests/reader.local.ts`) reports the tile counts recorded in `fixtures/manifest.json` (from a structural byte scan, independent of any reader); for `large-small-areas`, the two tiles outside any area are reported as unknown nodes, not tiles

---

## Phase 3 - Diagnostics, ceilings and unexpected structure

**Objective:** Anomalies are reported as early as they can be detected, ceilings stop corrupted or hostile files, and unexpected structure is preserved instead of repaired.

**Status:** `completed`. Commit of the full plan (reviewed as a whole): `5f7e1db` (utils), `7ad4aa2` (otbm), `d76c2b8` (examples), `5da20ea` (changeset), followed by a `docs` commit.

### Deliverables

- `packages/otbm/src/diagnostics.ts`: diagnostic codes and their default severity:
  - `file-above-reference`, `items-per-tile`, `container-children`, `item-nesting`, `node-properties` (warning thresholds)
  - `tile-outside-area` and `node-out-of-place` (structure kept as an unknown node)
  - `area-properties-extra` (extra bytes kept as the area's tail)
  - `tile-outside-header`, `average-items-per-tile`, `no-tiles` (end-of-read signals)
  - `tile-attribute-order` (non-canonical order of flags and inline items)
  - `possible-utf8-text`
- Fatal ceilings in the reader throw `ParseError` with the offset; `validate(bytes)` refuses files above the fatal size before reading
- `strict: true` turns warnings into `ParseError`

### Tests

- `packages/otbm/src/diagnostics.test.ts`: each code triggered by a minimal synthetic buffer; each fatal ceiling throws; `strict` escalates a warning; custom `limits` override the defaults
- `packages/otbm/tests/diagnostics.local.ts`: `large-small-areas` reports `area-properties-extra` and `tile-outside-area`; no other fixture reports a warning

### Validation

- `pnpm --filter @paradoxlab/otbm test:run` passes
- The local run lists diagnostics per fixture, and only `large-small-areas` has any

---

## Phase 4 - Encoder and streaming write

**Objective:** Piping the reader into the Encoder reproduces every fixture byte for byte, and `writeStream` hands out bounded chunks with backpressure.

**Status:** `completed`. Commit of the full plan (reviewed as a whole): `5f7e1db` (utils), `7ad4aa2` (otbm), `d76c2b8` (examples), `5da20ea` (changeset), followed by a `docs` commit.

### Deliverables

- `packages/otbm/src/encoder.ts`: `createOtbmEncoder(output, options)` implementing `OtbmVisitor` over the utils output buffer:
  - writes exactly the Shape it receives
  - fast path for items with no attributes and no children
  - `item(sid, 'node+inlineCount', …)` writes the count byte; an item with a count and no form in a v1 file uses `hasInlineCount` when given
  - strings through the `text` codec (`UnencodableTextError` propagates)
  - validation: balanced events, offsets inside the area, fatal ceilings, `maxBytes`
- `Otbm(options).source(bytes)`: the reader as an `OtbmSource` that yields after each area
- `Otbm(options).write(source): Uint8Array` and `writeStream(source, { chunkBytes = 1 MiB, maxBytes }): Generator<Uint8Array>` driving the source step by step and yielding when the buffer passes `chunkBytes`

### Tests

- `packages/otbm/src/encoder.test.ts`: every event kind encodes to the expected bytes; unbalanced events throw; an offset outside the area throws; `maxBytes` stops at the first chunk above it; a string with an emoji throws `UnencodableTextError`
- `packages/otbm/src/write-stream.test.ts`: chunks never exceed `chunkBytes` plus one area; the generator does not advance the source until the consumer pulls
- `packages/otbm/tests/roundtrip.spec.ts`: the two public fixtures round-trip byte for byte through `writeStream(otbm.source(bytes))`

### Validation

- `pnpm --filter @paradoxlab/otbm test:run` passes
- `tests/roundtrip.local.ts` reports **11 of 11** fixtures byte-identical (including `large-small-areas`, now preserved)

---

## Phase 5 - Object document

**Objective:** `load()` gives scripts and small maps an object model that is lossless because it is built from, and replayed as, the same events.

**Status:** `completed`. Commit of the full plan (reviewed as a whole): `5f7e1db` (utils), `7ad4aa2` (otbm), `d76c2b8` (examples), `5da20ea` (changeset), followed by a `docs` commit.

### Deliverables

- `packages/otbm/src/document.ts`:
  - `OtbmDocument` type in `types.ts` (header, map data, entries in file order, areas with tiles and items, towns, waypoints, unknown nodes, diagnostics) with `getTile(x, y, z)` and `stats()`
  - a collecting visitor that builds it
  - `documentSource(doc): OtbmSource` that replays it
- `Otbm(options).load(bytes, { onProgress }): OtbmDocument`; `write(doc)` and `writeStream(doc)` accept a document (an `OtbmSource`)

### Tests

- `packages/otbm/src/document.test.ts`: load then write is byte-identical for synthetic maps with every Shape feature; `getTile` finds tiles across areas; editing an item attribute changes only that item's bytes
- `packages/otbm/tests/document.local.ts`: 11 of 11 fixtures byte-identical through `write(load(bytes))`

### Validation

- `pnpm --filter @paradoxlab/otbm test:run` passes
- The local document test passes on every fixture

---

## Phase 6 - Source layout and Composer

**Objective:** A consumer with its own editable model writes a map in its Source layout: unedited areas come back byte-identical and new tiles go to canonical areas.

**Status:** `completed`. Commit of the full plan (reviewed as a whole): `5f7e1db` (utils), `7ad4aa2` (otbm), `d76c2b8` (examples), `5da20ea` (changeset), followed by a `docs` commit.

### Deliverables

- `packages/otbm/src/layout.ts`: `collectSourceLayout()` visitor producing a `SourceLayout` (per area: base and `Uint16Array` of `(dx << 8) | dy` in file order; MAP_DATA children order, root type, header, map data, towns, waypoints, unknown MAP_DATA children)
- `packages/otbm/src/composer.ts`: `composeOtbm(layout, tiles: OtbmTileSource): OtbmSource`:
  - `OtbmTileSource` = `{ emitTile(x, y, z, visitor): boolean; forEachTileNotIn(written, fn) }`
  - written-tile bitset per 256×256 area with a last-area cache (no allocation per lookup)
  - areas with every tile deleted are dropped; new tiles go to canonical areas sorted by `z, y, x`
  - `layout: 'preserve' | 'canonical'` option

### Tests

- `packages/otbm/src/composer.test.ts` (in-memory tile source): unedited map byte-identical; a deleted tile disappears and the rest stays in order; a new tile goes to a canonical area at the end; `canonical` mode sorts areas
- `packages/otbm/tests/composer.local.ts`: for every fixture, collect the layout, load tiles into a `Map`-backed tile source, compose and write; 11 of 11 byte-identical

### Validation

- `pnpm --filter @paradoxlab/otbm test:run` passes
- The local composer test passes on every fixture

---

## Phase 7 - Version upgrade

**Objective:** A map can be upgraded from v1 to v2 or v3 (and v2 to v3) in streaming, and downgrades are refused.

**Status:** `completed`. Commit of the full plan (reviewed as a whole): `5f7e1db` (utils), `7ad4aa2` (otbm), `d76c2b8` (examples), `5da20ea` (changeset), followed by a `docs` commit.

### Deliverables

- `packages/otbm/src/upgrade.ts`: `upgradeOtbm(source, targetVersion): OtbmSource`, an event transform:
  - v1 → v2: `'node+inlineCount'` items become `'node'` with a leading `count` attribute
  - every step: header version replaced
  - a target lower than the source version throws `ParseError`

### Tests

- `packages/otbm/src/upgrade.test.ts`: v1 inline count becomes the count attribute; v2 → v3 changes only the header version byte; downgrade throws
- `packages/otbm/tests/upgrade.local.ts`: `small-acceptance-otbm1-otb1-3` upgraded to v3 and read back has the same tiles, items and counts as the original

### Validation

- `pnpm --filter @paradoxlab/otbm test:run` passes

---

## Phase 8 - Semantic comparator and property tests

**Objective:** The lossless contract is checked beyond the fixtures: random valid event streams and semantic comparison of any two maps.

**Status:** `completed`. Commit of the full plan (reviewed as a whole): `5f7e1db` (utils), `7ad4aa2` (otbm), `d76c2b8` (examples), `5da20ea` (changeset), followed by a `docs` commit.

### Deliverables

- `packages/otbm/src/compare.ts`: `compareOtbm(a, b, options)` returning the differences (header, map data, tiles, items, attributes, towns, waypoints, unknown nodes) by position, comparing only what is present (S5 lesson 7); exported for consumers' own tests
- `packages/otbm/src/arbitraries.ts` (test-only, excluded from the build): `fast-check` arbitraries for headers, tiles, items with nested containers, attributes, unknown tails and unknown nodes

### Tests

- `packages/otbm/src/compare.test.ts`: each kind of difference is reported once
- `packages/otbm/src/roundtrip.property.test.ts`:
  - `read(encode(events))` yields the same events
  - `encode(read(bytes))` yields the same bytes for encoder-produced files
  - `upgradeOtbm` never loses an item

### Validation

- `pnpm --filter @paradoxlab/otbm test:run` passes with the property tests at their default run count
- Coverage thresholds of the package (95/95/90/90) still pass with `pnpm --filter @paradoxlab/otbm test:cov`

---

## Phase 9 - Performance validation

**Objective:** The package meets the Node targets on every size, with numbers recorded next to the S5 references.

**Status:** `completed`. Commit of the full plan (reviewed as a whole): `5f7e1db` (utils), `7ad4aa2` (otbm), `d76c2b8` (examples), `5da20ea` (changeset), followed by a `docs` commit.

### Deliverables

- `packages/otbm/tests/otbm.bench.local.ts` replacing `src/otbm.bench.ts`: best of 3 for `read` (empty visitor), `writeStream(otbm.source(bytes))`, `load`, and `write(load(bytes))`, on medium, large, xlarge and stress; MB/s, heap after load and peak extra memory during `writeStream`; optional `--profile`
- `packages/otbm/results/perf.md`: machine, Node version, date, the table, and the comparison with the 0.2 baseline (8.5 MB/s) and with S5 (`read` pass 0.9 s, write 3.05 s on the xlarge)

### Validation

- `results/perf.md` shows every target met, or each miss with its justification
- No target regresses more than 10% between two runs on the same machine

---

## Phase 10 - Examples, README and release

**Objective:** The 0.3 API is documented by examples that run in CI, and the 0.2 API is gone.

**Status:** `completed`. Commit of the full plan (reviewed as a whole): `5f7e1db` (utils), `7ad4aa2` (otbm), `d76c2b8` (examples), `5da20ea` (changeset), followed by a `docs` commit.

### Deliverables

- `examples/` as private workspace package `@paradoxlab/examples` (added to `pnpm-workspace.yaml`, excluded from release), each runnable with `pnpm --filter @paradoxlab/examples run <name>`:
  - `otbm-stats.ts`: read and count with a visitor
  - `otbm-upgrade.ts`: v1 → v3 in streaming
  - `otbm-edit.ts`: load, change an item, write
  - `otbm-compose.ts`: own tile model plus Source layout
  - `otbm-detect-codec.ts`: suggest a codec from a map's strings

  Each runs against a map generated by the encoder when no fixture is present.
- `examples/examples.test.ts`: runs every example against generated maps in CI
- `packages/otbm/README.md` rewritten from the examples (no snippet that does not run)
- 0.2 files deleted (`otbm-stream.ts`, `otbm-attributes.ts`, `otbm-writer.ts` and their tests)
- Changeset: `@paradoxlab/otbm` minor 0.3.0, listing the removed 0.2 API

### Tests

- `examples/examples.test.ts`

### Validation

- `pnpm test:run`, `pnpm check`, `pnpm typecheck`, `pnpm knip`, `pnpm circular` and `pnpm attw` pass
- `pnpm --filter @paradoxlab/otbm build` produces `dist` whose exports match `index.ts`
