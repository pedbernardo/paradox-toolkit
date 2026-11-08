# Fixtures

Maps, item databases and client assets used by tests and benchmarks. `manifest.json` indexes everything: each map's purpose, OTBM version, matching `items.otb` and client, house and spawn XMLs, tags, and structural facts measured by a byte scan.

## Rules

- **Everything is local by default** (git-ignored). Only `manifest.json`, this README, the helper package (`package.json`, `src/`) and public `*.fixture.*` files are versioned.
- **Tests read the manifest** through `@paradoxlab/fixtures` and skip, with the missing id in the suite name, whatever is not on disk. CI depends only on `*.fixture.*` files.
- **File headers were not edited.** A map may still name its original house and spawn XMLs in its header; the manifest is what links them.
- **Structural facts** (`scan`) come from `src/scan.ts`, which shares no code with any OTBM reader. Refresh them with `pnpm --filter @paradoxlab/fixtures scan` after adding a map.

## Names

Maps are named `<size>-<purpose>-otbm<N>-otb<major>-<minor>`:

- **size:** `small` < 5 MB, `medium` 5-20 MB, `large` 20-60 MB, `xlarge` > 60 MB;
- **purpose:** what the map is for, never where it came from;
- **`otbm<N>`:** OTBM format version (v1-v4; the raw header field is N - 1);
- **`otb<major>-<minor>`:** the OTB lineage written in the map header, which defines the sid space. The client version is in the matrix below; it is not used in names because one client can have several OTB versions (8.60 has 3.19 and 3.20).

Item databases are named `items-otb<major>-<minor>.otb`; clients live in `client/<version>/client-<version>.{dat,spr}`.

## Matrix

| id | OTBM | OTB (client) | Client assets | Purpose |
|---|---|---|---|---|
| `small-legacy-otbm1-otb2-unk` (public) | v1 | 2.-1 | - | v1 with OTB major 2; reading needs the item database |
| `small-acceptance-otbm1-otb1-3` | v1 | 1.3 (7.60) | 772 | Author's real 7.72 map |
| `small-wide-otbm1-otb1-3` | v1 | 1.3 (7.60) | 772 | Second v1 map on OTB 1.3, 5000x5000 |
| `small-houses-spawns-otbm2-otb3-19` (public) | v2 | 3.19 (8.60) | 860 | House and spawn XMLs |
| `small-distro-xml-otbm2-otb3-10` | v2 | header 3.10, assets 3.23 (8.70) | 870 | Distro map with house and spawn XMLs; 24 thousand small areas |
| `small-spawns-otbm3-otb3-12` | v3 | 3.12 (8.40) | - | v3 with large spawns |
| `small-modern-otbm3-otb3-29` | v3 | 3.29 (9.20) | - | 9.20 lineage; deepest item nesting (3) |
| `small-modern-otbm3-otb3-40` | v3 | 3.40 (9.60) | 960 | 9.60 lineage (u32 sprite ids) |
| `medium-reference-otbm2-otb3-15` | v2 | 3.15 (8.50) | - | Medium (~12 MB) |
| `large-small-areas-otbm3-otb3-20` | v3 | 3.20 (8.60) | 860 | 206 thousand 4x4 areas; malformed at the source (one area with extra property bytes, two tiles outside any area) |
| `xlarge-stress-otbm2-otb3-15` | v2 | 3.15 (8.50) | - | Stress (~79 MB); up to 24 item nodes per tile |
| `xlarge-stress-alt-otbm2-otb3-23` | v2 | 3.23 (8.70) | 870 | The largest known map (~104 MB, 9.5 M tiles); the reference for ceilings |

Clients with assets: 772, 860, 870, 960, 1098. OTBs: 1.3, 2.-1, 3.12, 3.15, 3.19, 3.20, 3.23, 3.29, 3.40, 3.57.

## Known gaps

- **No real Polish (windows-1250) or UTF-8 map:** text codec detection is tested only on synthetic text.
- **OTB 2.6 to 2.10** (8.0-8.1): missing, so v1 maps of that lineage are not covered.
- **No native 10.98 map:** the 1098 client and OTB 3.57 exist, but no map saved with 10.x items.
