# @paradoxlab/otbm 0.3: performance

2026-11-08 · Intel Core i5-1335U, 16 GB, Node 26.11.1 · best of 5, each cell in its own process (`pnpm --filter @paradoxlab/otbm bench`). `copy` is `writeStream(otbm.source(bytes))`: read and write back, byte-identical; its memory is what the writer holds (buffer plus the chunk in hand), sampled after a collection at every chunk.

## Results

| Fixture | MB | `read` | `copy` · writer memory | `load` · heap | `write(document)` |
|---|---|---|---|---|---|
| medium-reference-otbm2-otb3-15 | 11.6 | 92 ms | 166 ms · 3 MB | 763 ms · 444 MB | 117 ms |
| large-small-areas-otbm3-otb3-20 | 33.0 | 383 ms | 773 ms · 3 MB | 3,255 ms · 1,337 MB | 697 ms |
| xlarge-stress-otbm2-otb3-15 | 78.7 | 498 ms | 1,163 ms · < 1 MB | 7,499 ms · 2,978 MB | 1,947 ms |
| xlarge-stress-alt-otbm2-otb3-23 | 103.9 | 714 ms | 1,408 ms · < 1 MB | 9,823 ms · 3,876 MB | 2,579 ms |

## The editor's path: Source layout and composer

Measured 2026-11-08, same machine and rules. `read-layout` is `read` with `collectSourceLayout`, what an editor does on open. `compose` is `writeStream(composeOtbm(layout, tiles))` with every tile kept in a model and served from 256×256 chunks with small-integer keys, what an editor does on save; the bytes match the file.

| Fixture | MB | `read` | `read-layout` | `compose` |
|---|---|---|---|---|
| xlarge-stress-otbm2-otb3-15 | 78.7 | 423 ms | 518 ms | 1,992 ms |
| xlarge-stress-alt-otbm2-otb3-23 | 103.9 | 727 ms | 735 ms | 2,511 ms |

- Collecting the layout costs at most 0.1 s on top of `read`.
- `compose` stays within the 2.5 s `copy` target on both maps, with the tiles' objects in the heap (the GC accounts for much of the time; a model in typed arrays would cost less).
- Two fixes came from this measurement: the composer walked each area through a closure that allocated an `[x, y]` pair per tile (stress: 3,366 → 1,992 ms), and a tile source keyed by `x + y·65,536 + z·2³²` falls out of V8's small integers, which made the first version of this bench take 5 s (a note for the editor's own tile index).

## Against the references

| | S1 reader (spike) | `@paradoxlab/otbm` 0.2 | 0.3 |
|---|---|---|---|
| `read`, medium | 110 ms | n/a (no event reader) | 92 ms |
| `read`, large | 395 ms (reads it wrong: ignores structure) | n/a | 383 ms |
| `read`, stress | 709 ms | n/a | 498 ms |
| `read`, stress-alt | 982 ms | n/a | 714 ms |
| write the stress-alt from a model | 3,050 ms (S5, Node) | not lossless | 1,408 ms (`copy`: read + write); 2,511 ms through the composer |
| `load`, stress | n/a | 9,268 ms · 2,594 MB | 7,499 ms · 2,978 MB |

S1 numbers were measured on the same machine and day with the same rules (best of 5, own process), by its `readOtbm` with a no-op visitor.

## Targets

| Target (v0.02 grill) | Result |
|---|---|
| `read` ≤ 1.0 s on the xlarge | met: 714 ms |
| `copy` ≤ 2.5 s on the xlarge | met: 1,408 ms |
| `copy` ≤ 1 s on the large | met: 773 ms |
| writer memory ≤ 32 MB | met: ≤ 3 MB |
| `load` | revised: no regression in time against 0.2 (met, 19% faster), heap measured. Objects for every tile and item cost about 15% more heap than 0.2 because they keep the Shape (`kind`, `form`); `load` is meant for small and medium maps, and the stress-alt only loads with a larger heap. Large maps go through `read`, `source` and the composer. |

## How the reader was rebuilt, step by step

The first reader of this plan was written anew and measured only at the end; with a measurement harness that also loaded a document in every process, its numbers were not comparable. It was rebuilt from the 0.2 structure (one pass over the bytes, a typed-array context stack, properties processed when the first child or the end arrives), adding one feature at a time:

| Step | stress | stress-alt |
|---|---|---|
| S1 reference | 709 ms | 982 ms |
| 0.2 loop with events for header, areas, tiles, items (no attributes), reading through `EscapedSliceReader` | 826 ms | 1,021 ms |
| Properties read in place from the file unless they hold an escape byte (tracked by the loop) | 600 ms | 730 ms |
| Item and map data attributes, tails, v1 inline counts | 806 ms | 1,066 ms |
| Bare tiles and items kept on a small path, the rest in separate methods (the larger functions were no longer inlined) | 578 ms | - |
| Classification by parent, unknown nodes as raw bytes, diagnostics, ceilings | 670 ms | 917 ms |
| Final run with the corrected harness | 498 ms | 714 ms |

Tried and dropped: a shortcut for item nodes at node start that skipped classification (no measurable gain).
