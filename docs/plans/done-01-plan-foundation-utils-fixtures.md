# Execution Plan - Foundation: utils, text codecs and fixtures

This plan follows the conventions described in [docs/plans/README.md](README.md).

## References

- [docs/plans/README.md](README.md)
- [CONTEXT.md](../../CONTEXT.md)
- [ADR 0001 - OTBM reader and encoder share one event contract](../adr/0001-otbm-symmetric-event-contract.md)
- [ADR 0002 - Strings are decoded with a per-file text codec](../adr/0002-text-codec-per-file.md)
- `../mapeditor/fixtures/` (source of the fixtures and of the manifest schema)
- `../mapeditor/spikes/s5-otbm-write/src/output-buffer.ts` (reference for the output buffer)

## Design decisions already made

- **One output buffer per file, chunks of fixed size handed out at safe points**: see [ADR 0001](../adr/0001-otbm-symmetric-event-contract.md) (consequences) and S5 lesson 9
- **Text codec per file; windows-1252 default; 1250, 1251 and UTF-8 built in; unencodable text throws**: see [ADR 0002](../adr/0002-text-codec-per-file.md)
- **Codec detection only suggests**: see [ADR 0002](../adr/0002-text-codec-per-file.md)
- **OTBM v1 reading takes a `hasInlineCount(sid)` predicate built by `@paradoxlab/otb`**: see [ADR 0001](../adr/0001-otbm-symmetric-event-contract.md)
- **Fixtures at the repository root with a manifest; size and purpose in the file name; only the manifest, the README and `*.fixture.*` files are committed**: decided in the v0.02 grill (2026-11-07)
- **`fast-check` for property tests**: decided in the v0.02 grill

---

## Phase 1 - Root fixtures and manifest

**Objective:** Every test in the repository can find a map, its `items.otb` and its client files by id, and nothing proprietary can be committed by accident.

**Status:** `completed`. Commit per phase: `f8ba887` (code), followed by a `docs` commit for the README and this plan.

**As built:**
- **The helper ports the editor's API** (`createFixtures`, `mapFixture`, `itemsFixture`, `clientFixture`, `describeWithFixture`), plus `presentMaps`, `readFixture` and `scanOtbm`. This replaces the planned `fixture(id)`: the editor's API had already been validated and returns `undefined`, not `null`.
- **The code lives in `fixtures/src/`.** The `.gitignore` ignores `fixtures/client/` and everything under `maps/` and `items/` except `*.fixture.*`.
- **A twelfth map was added:** `small-wide-otbm1-otb1-3`, the toolkit's former `local.large-v0`, which had no counterpart in the editor.
- **The 0.2 `otbm` tests point at `fixtures/maps` by path** instead of going through the helper, because Phase 10 of the otbm plan deletes them.
- **The scan confirms, without any reader,** the two stray tiles in `large-small-areas` (`strayTiles: 2`).

### Deliverables

- `fixtures/` at the root, copied from `../mapeditor/fixtures/` (`maps/`, `items/`, `client/<version>/`), with maps renamed to `<size>-<purpose>-otbm<N>-otb<major>-<minor>` (`small` < 5 MB, `medium` 5-20 MB, `large` 20-60 MB, `xlarge` > 60 MB), house and spawn XMLs renamed alongside:

  | Editor id | Toolkit id |
  |---|---|
  | `legacy-otbm1-otb2-unk` (public) | `small-legacy-otbm1-otb2-unk` |
  | `acceptance-otbm1-otb1-3` | `small-acceptance-otbm1-otb1-3` |
  | `houses-spawns-otbm2-otb3-19` (public) | `small-houses-spawns-otbm2-otb3-19` |
  | `distro-xml-otbm2-otb3-10` | `small-distro-xml-otbm2-otb3-10` |
  | `spawns-otbm3-otb3-12` | `small-spawns-otbm3-otb3-12` |
  | `modern-otbm3-otb3-29` | `small-modern-otbm3-otb3-29` |
  | `modern-otbm3-otb3-40` | `small-modern-otbm3-otb3-40` |
  | `medium-otbm2-otb3-15` | `medium-reference-otbm2-otb3-15` |
  | `large-otbm3-otb3-20` | `large-small-areas-otbm3-otb3-20` |
  | `stress-otbm2-otb3-15` | `xlarge-stress-otbm2-otb3-15` |
  | `stress-alt-otbm2-otb3-23` | `xlarge-stress-alt-otbm2-otb3-23` |

- `fixtures/manifest.json`: per map, the id, OTBM version, OTB lineage, matching `items.otb` and client, XMLs, size in bytes, tags, and structural facts measured by a byte scan independent of any reader (tile count, item-node count, maximum node depth, item nesting, items per tile); per OTB, its full version and the client it belongs to
- `fixtures/scan.ts`: the structural byte scan that fills those facts (`pnpm --filter @paradoxlab/fixtures scan`)
- `fixtures/README.md`: naming rule, size bands, matrix (with the client version next to each `otb<major>-<minor>`), known gaps (no Polish or UTF-8 map yet)
- `.gitignore`: `fixtures/**` ignored except `manifest.json`, `README.md`, `package.json`, `index.ts` and `*.fixture.*` (XMLs included; today they are not ignored at all)
- `fixtures/package.json` as private workspace package `@paradoxlab/fixtures`, added to `pnpm-workspace.yaml`
- `fixtures/index.ts`: `fixture(id)` returning `{ map, otb, dat, spr, houseXml, spawnXml }` absolute paths or `null` per missing file, and `fixtureIds(filter?)`; reads the manifest once
- `packages/otbm/fixtures/` removed; `packages/otbm/tests/*` and `otbm.bench.ts` use `@paradoxlab/fixtures`

### Tests

- `fixtures/index.test.ts`: manifest parses; every id resolves; missing files yield `null`, never throw

### Validation

- `git status` after the copy lists only `fixtures/manifest.json`, `fixtures/README.md`, `fixtures/package.json`, `fixtures/index.ts`, `fixtures/index.test.ts` and the two public `*.fixture.otbm` (with their XMLs)
- `pnpm test:run` passes; `pnpm knip` reports nothing new

---

## Phase 2 - Output buffer

**Objective:** Writers in the toolkit escape into one growing buffer per file and hand out chunks of a configurable size, with no allocation per node or per area.

**Status:** `completed`. Commit per phase: `a18aaeb`.

**As built:** `createEscapedBinaryWriter` was removed in Phase 3, not here: the 0.2 `otbm` writer needed `escStr`, which only arrived with the text codecs. `escU64` was added for the OTB writer.

### Deliverables

- `packages/utils/src/output-buffer.ts`: `createOutputBuffer({ initialBytes })` returning `OutputBuffer` with `u8/u16/u32/bytes` (raw), `escU8/escU16/escU32/escBytes` (escaped with `0xfd`), `length`, `mark()`, `truncate(mark)`, `take(): Uint8Array` (hands out the bytes written so far and resets length, keeping capacity)
- `OutputBuffer` type in `packages/utils/src/types.ts`, re-exported from `index.ts`
- `packages/otb/src/otb-writer.ts` moves from `createEscapedBinaryWriter` to `createOutputBuffer`
- `createEscapedBinaryWriter` removed once no package uses it

### Tests

- `packages/utils/src/output-buffer.test.ts`: escaping of `0xfd/0xfe/0xff` in every width; growth across the initial capacity; `take` returns exactly the bytes since the last `take`; `truncate` drops a group
- `packages/otb/src/otb-writer.test.ts`: existing roundtrip tests unchanged and passing

### Validation

- `pnpm --filter @paradoxlab/utils test:run` and `pnpm --filter @paradoxlab/otb test:run` pass
- `grep -r createEscapedBinaryWriter packages/*/src` returns nothing

---

## Phase 3 - Text codecs

**Objective:** Every string the toolkit reads or writes goes through a **Text codec**, and an unedited string in any built-in single-byte codec round-trips byte for byte.

**Status:** `completed`. Commit per phase group (phases 3-6 reviewed together): `8d759c3` (utils), `a3d13a7` (dat), `7070982` (otb), `5cff963` (otbm), `d695c52` (changesets), `1739514` (docs).

**As built:**
- **The codec is an option of each reader and writer instance** (`createBinaryReader(bytes, { text })`, `createEscapedBinaryReader(bytes, { text, escapeMarker })`, `createEscapedSliceReader(bytes, { text, escapeMarker })`, `createBinaryWriter({ text })`, `createOutputBuffer({ text })`). It is not a parameter of each `str()` call: the codec belongs to a file, which maps to one reader or writer, and this way it never has to be threaded through the DAT flag rules.
- **UTF-8 keeps invalid bytes as U+DC80..U+DCFF** (surrogate escape), so even broken UTF-8 round-trips.
- **No `DEFAULT_TEXT_CODEC` export:** knip flagged it as a duplicate of `windows1252`, which is the documented default.
- **`createEscapedBinaryWriter` removed here.** The 0.2 `otbm` writer moved to `createOutputBuffer`, and its strings are now windows-1252 in both directions; before, they were read as ISO-8859-1 and written as the low byte.
- **`fast-check` ^4.10.2 in the catalog.**
- **`dat` and `otb` got no `text` option, against the deliverable below.** Their strings are game content shipped with the client, not user text: of the 17 OTBs measured, only two names are non-ASCII, and both were already corrupted at the source. Both formats use windows-1252 in both directions, and ADR 0002 was amended to match. The codec option stays in `utils` and in the OTBM plan.

### Deliverables

- `packages/utils/src/text-codec.ts`:
  - `TextCodec` type: `{ name, decode(bytes): string, encode(text): Uint8Array, canEncode(text): boolean }`
  - `windows1252`, `windows1250`, `windows1251`: built from `TextDecoder(label)` over bytes 0-255 at module load, with an inverse `Map` for encoding
  - `utf8`: `TextDecoder`/`TextEncoder`; invalid sequences are decoded byte-preserving (reported by the caller as a diagnostic)
  - `UnencodableTextError` (in `errors.ts`) with the string, the character and its index
- `BinaryReader.str` / `EscapedSliceReader.str` take a `TextCodec` instead of an encoding label; `BinaryWriter.str` and `OutputBuffer.escStr` take one too
- `packages/dat` and `packages/otb`: `text?: TextCodec` option on the factories (`Dat(version, { text })`, `Otb({ text })`), default `windows1252`

### Tests

- `packages/utils/src/text-codec.test.ts`:
  - each single-byte codec: 256 distinct characters, all 256 bytes round-trip
  - `windows1252` decodes `0x92` to `’` and encodes it back to `0x92`
  - `windows1250` decodes `0xb3` to `ł`
  - each codec throws `UnencodableTextError` on a character it cannot encode (an emoji)
  - UTF-8 round-trips `ã` as `C3 A3`
- Property test with `fast-check` (added to the catalog at the latest stable version outside the supply-chain quarantine): for every single-byte codec, `encode(decode(bytes)) === bytes` for arbitrary byte arrays

### Validation

- `pnpm --filter @paradoxlab/utils test:run`, `pnpm --filter @paradoxlab/dat test:run` and `pnpm --filter @paradoxlab/otb test:run` pass
- `grep -rn "TextDecoder('latin1')" packages/*/src` returns nothing

---

## Phase 4 - Codec detection

**Objective:** Given the strings of a file, the toolkit suggests a **Text codec** with a confidence and sample decodings.

**Status:** `completed`. See Phase 3 for the commits.

**As built:** counting letter frequencies alone gave low confidence, because Portuguese read as windows-1251 turns into Cyrillic letters (`Nгo`). Each high byte is now scored by context: +1 for a character typical of the code page, -1 for a letter of another script next to its neighbors, -1 for a symbol inside a word (`Z³oty`). Words of 5 or more letters that are more than 70% high bytes count against the Latin code pages, since that is Cyrillic read with the wrong one (`Äîáðî`).

### Deliverables

- `packages/utils/src/detect-text.ts`: `detectTextCodec(strings: Iterable<Uint8Array>)` returning `{ codec, confidence, samples }`
  - UTF-8 when the strings with bytes ≥ 0x80 form valid multi-byte sequences
  - windows-1250 vs windows-1252 by frequency of Polish letters (`ł ą ę ś ż ź ć ń`) vs Western letters (`ã ç é ê õ ñ`) in each decoding
  - windows-1252 with confidence 1 when no byte ≥ 0x80 appears
  - `samples`: up to 5 strings decoded with the suggested codec

### Tests

- `packages/utils/src/detect-text.test.ts`: synthetic Portuguese, Polish, Russian and UTF-8 texts encoded with their codecs are detected; pure ASCII returns windows-1252 with confidence 1; a mixed sample returns the majority with lower confidence

### Validation

- `pnpm --filter @paradoxlab/utils test:run` passes
- The fixtures README lists the missing real Polish and UTF-8 maps as a known gap

---

## Phase 5 - Inline-count predicate from the OTB

**Objective:** Anyone with an `items.otb` can build the predicate that OTBM v1 reading needs, without `otbm` depending on `otb`.

**Status:** `completed`. See Phase 3 for the commits.

**As built:** `inlineCountOf` lives in `packages/otb/src/otb-flags.ts`, the module for item flag semantics, not in a file of its own. Its tests are in `otb-flags.test.ts` and in `tests/otb.local.ts`, which still reads `items-772.otb` from the package; the `otb` fixtures move to the root in a later plan.

### Deliverables

- `packages/otb/src/inline-count.ts`: `inlineCountOf(otb: OtbFile): (sid: number) => boolean`, true for stackable, splash and fluid-container items; backed by a bitset over the sid range
- exported from `packages/otb/src/index.ts`

### Tests

- `packages/otb/src/inline-count.test.ts`: synthetic OTB with one item of each group; out-of-range sids return false
- `packages/otb/tests/inline-count.local.ts`: with `items-otb1-3.otb`, the predicate is true for a known stackable (gold coin) and false for a ground

### Validation

- `pnpm --filter @paradoxlab/otb test:run` passes
- `pnpm circular` shows no edge from `otbm` to `otb`

---

## Phase 6 - Release notes

**Objective:** The foundation changes are documented for the next release.

**Status:** `completed`. See Phase 3 for the commits.

**As built:**
- **A fourth changeset:** a patch for `@paradoxlab/otbm`, whose 0.2 strings changed behavior.
- **The "Shared primitives" section of `BINARY-FORMATS.md` was rewritten.** It still described `EscapedBinaryWriter` and "Latin-1 (ISO-8859-1)", both wrong now.
- **`pnpm changeset status`** shows `utils`, `dat` and `otb` at minor, plus `otbm` at patch and the internal dependents (`spr`, `thinger`, `spriter`) at patch.

### Deliverables

- Changesets: `@paradoxlab/utils` minor (output buffer, text codecs, detection; `createEscapedBinaryWriter` removed), `@paradoxlab/otb` minor (`inlineCountOf`, `text` option), `@paradoxlab/dat` minor (`text` option)
- `docs/BINARY-FORMATS.md`: a "Strings" section pointing to ADR 0002

### Validation

- `pnpm changeset status` lists the three packages with the intended bump
- `pnpm check`, `pnpm typecheck`, `pnpm knip` and `pnpm circular` pass
