# @paradoxlab/backpack: performance

## Sprite sheets

2026-11-08 · Intel Core i5-1335U, 16 GB, Node 26.11.1 · each cell in its own process (`pnpm --filter @paradoxlab/backpack bench:sprites`). The spriter 0.2 rows were measured the same way before the package was removed from the repository. Every sprite of the client, default options (4096 px pages, 1 px padding, deflate level 6). Peak memory is the process's maximum resident set.

| Client | Sprites | Tool | Time | PNG total | Pages | Largest side | Peak memory |
|---|---|---|---|---|---|---|---|
| 772 | 10,962 | spriter 0.2 (sharp, no palette) | 11,788 ms | 10.6 MB | 1 | 4,091 px | 238 MB |
| 772 | 10,962 | backpack | 669 ms | 9.8 MB | 1 | 4,091 px | 307 MB |
| 772 | 10,962 | backpack, trimmed | 746 ms | 10.5 MB | 1 | 4,096 px | 265 MB |
| 860 | 36,386 | spriter 0.2 | 39,178 ms | 28.7 MB | 1 | 9,701 px | 500 MB |
| 860 | 36,386 | backpack | 2,029 ms | 25.4 MB | 3 | 4,091 px | 556 MB |
| 860 | 36,386 | backpack, trimmed | 2,101 ms | 27.5 MB | 2 | 4,096 px | 562 MB |
| 960 | 66,560 | spriter 0.2 | 53,801 ms | 38.5 MB | 1 | 17,720 px | 796 MB |
| 960 | 66,560 | backpack | 4,540 ms | 32.3 MB | 5 | 4,091 px | 734 MB |
| 960 | 66,560 | backpack, trimmed | 3,236 ms | 35.5 MB | 2 | 4,096 px | 748 MB |
| 1098 | 338,944 | spriter 0.2 | 214,428 ms | 78.7 MB | 1 | 90,221 px | 3,322 MB |
| 1098 | 338,944 | backpack | 26,777 ms | 58.2 MB | 23 | 4,091 px | 2,094 MB |
| 1098 | 338,944 | backpack, trimmed | 16,169 ms | 65.1 MB | 6 | 4,096 px | 2,114 MB |

## Reading the numbers

- **Lossless:** decoding the pages gives back every sprite pixel for pixel, trimmed or not (`tests/backpack-sprites.local.ts`, 772 and 1098).
- **Pages fit a GPU texture.** From 8.60 on, spriter's single sheet is taller than the 16,384 px most GPUs accept.
- **Trimming** packs fewer pixels (6 pages instead of 23 on the 1098) and is faster, but the PNGs are 7-12% larger: sprites from unrelated items end up side by side and compress worse. It stays off by default.
- **No row filters.** The first encoder chose a PNG filter per row (minimum sum of absolute differences, the usual heuristic). Measured against leaving rows unfiltered, it lost on every page: on sprite pages, with transparent gaps and repeated pixel art, deflate finds more repeats in the raw bytes. Unfiltered rows made the pages 7-24% smaller and the builds 3.5-11x faster (the table above; the earlier numbers were 772: 4,453 ms · 10.5 MB, 1098: 95,509 ms · 76.5 MB).

  | Page | Unfiltered, deflate 6 | Filter per row |
  |---|---|---|
  | Sprite sheet 772 | 9.79 MB · 569 ms | 10.50 MB · 2,790 ms |
  | Asset Pack 772 | 10.92 MB · 758 ms | 12.07 MB · 3,507 ms |
  | Asset Pack 1098, page 0 | 13.62 MB · 900 ms | 15.89 MB · 3,083 ms |

  Deflate level 9 saves under 1% for 3x the time; a single fixed filter (sub, up) is 9-17% larger than none.
- **Memory** on the 1098 is dominated by `@paradoxlab/spr`, which keeps every decoded sprite in a cache (339 thousand × 4 KB ≈ 1.4 GB). Bounding that cache is a change to the `spr` package, recorded as follow-up work.

## Content views

2026-11-08 · same machine · 10.98 client with OTB 3.57 (25,548 items), warm runs.

| Operation | Time |
|---|---|
| `viewContent` (sid index, built once) | 1.6 ms |
| Every sid through views: `get`, `has(Stackable)`, `appearance.sprite(0)` | 3.0 ms |
| Same reads on raw columns with a `Map` from sid to row | 5.4 ms |
| 1,000 lookups with `items.sid.indexOf` | 41 ms |
| 1,000 lookups with `items.get` | 0.13 ms |

Views keep the columns as the only storage and are made on demand; the sid index is one `Int32Array`.

## Asset Packs

2026-11-08 · same machine · `pnpm --filter @paradoxlab/backpack bench:pack`: best of 3 processes per cell (the machine throttles under sustained load, and single runs varied up to 2x). Build is `buildPack` from parsed files; load is `loadPack` from files already in memory (parse plus typed arrays), with heap and ArrayBuffers counted.

| Client | Items | Appearances | Frames | Pages | Pages + items + render | Build · peak memory | Load · memory |
|---|---|---|---|---|---|---|---|
| 772 | 4,990 | 4,990 | 14,513 | 1 · 12.2 Mpx | 10.58 + 0.31 + 0.63 = 11.52 MB | 823 ms · 378 MB | 2.4 ms · 1.1 MB |
| 860 | 11,827 | 11,604 | 22,860 | 1 · 14.6 Mpx | 18.66 + 0.73 + 1.12 = 20.52 MB | 1,382 ms · 530 MB | 4.6 ms · 2.4 MB |
| 870 | 12,498 | 12,245 | 23,971 | 1 · 15.4 Mpx | 19.79 + 0.78 + 1.18 = 21.75 MB | 1,431 ms · 556 MB | 5.2 ms · 2.4 MB |
| 960 | 17,703 | 16,172 | 31,426 | 2 · 20.2 Mpx | 22.79 + 1.13 + 1.55 = 25.46 MB | 1,994 ms · 637 MB | 8.1 ms · 3.6 MB |
| 1098 | 25,548 | 23,626 | 51,752 | 2 · 33.3 Mpx | 30.06 + 1.64 + 2.44 = 34.14 MB | 3,101 ms · 898 MB | 11.7 ms · 5.2 MB |

### Against S4 (the editor's spike, same machine)

| Client | S4 build | backpack build | S4 pages, unfiltered | backpack pages | backpack pages, padding 1 |
|---|---|---|---|---|---|
| 772 | 0.9 s | 0.82 s | 10.6 MB · 12.2 Mpx | 10.58 MB · 12.2 Mpx | 10.92 MB · 13.0 Mpx |
| 860 | 1.6 s | 1.38 s | 18.6 MB | 18.66 MB | 18.91 MB |
| 870 | 1.7 s | 1.43 s | | 19.79 MB | 20.02 MB |
| 960 | 2.5 s | 1.99 s | 22.7 MB | 22.79 MB | 23.05 MB |
| 1098 | | 3.10 s | 30.0 MB · 2 pages, 33.3 Mpx | 30.06 MB · 2 pages, 33.3 Mpx | 30.53 MB · 3 pages, 35.8 Mpx |

### Targets

| Target (plan) | Result |
|---|---|
| Build no slower than S4 by more than 10% | met: 9-20% faster on every client |
| Pages smaller than S4's unfiltered PNGs | revised: equal, within 0.4%. Same layout, and S4 already wrote unfiltered rows, which turned out to be the best choice (see "No row filters") |
| `loadPack` of the 1098 pack ≤ 50 ms in Node | met: 11.7 ms |

- **Every item appearance is composed and trimmed**: frames are shared by their layer sprite tuple, and grounds and borders take the start of page 0.
- **Padding** is 0 by default in packs, as in S4: renderers sample pack pages nearest-neighbor, and the 1 px gap would cost about 3% and, on the 1098, a third page. `buildPack({ padding: 1 })` is there for renderers that sample linearly. Sprite sheets keep 1 px.
