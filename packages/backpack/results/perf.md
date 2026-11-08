# @paradoxlab/backpack: sprite sheet performance

2026-11-08 · Intel Core i5-1335U, 16 GB, Node 26.11.1 · each cell in its own process (`pnpm --filter @paradoxlab/backpack bench:sprites`). The spriter 0.2 rows were measured the same way before the package was removed from the repository. Every sprite of the client, default options (4096 px pages, 1 px padding, deflate level 6). Peak memory is the process's maximum resident set.

| Client | Sprites | Tool | Time | PNG total | Pages | Largest side | Peak memory |
|---|---|---|---|---|---|---|---|
| 772 | 10,962 | spriter 0.2 (sharp, no palette) | 11,788 ms | 10.6 MB | 1 | 4,091 px | 238 MB |
| 772 | 10,962 | backpack | 4,453 ms | 10.5 MB | 1 | 4,091 px | 298 MB |
| 772 | 10,962 | backpack, trimmed | 4,196 ms | 11.0 MB | 1 | 4,096 px | 265 MB |
| 860 | 36,386 | spriter 0.2 | 39,178 ms | 28.7 MB | 1 | 9,701 px | 500 MB |
| 860 | 36,386 | backpack | 22,091 ms | 28.5 MB | 3 | 4,091 px | 514 MB |
| 860 | 36,386 | backpack, trimmed | 16,557 ms | 29.8 MB | 2 | 4,096 px | 537 MB |
| 960 | 66,560 | spriter 0.2 | 53,801 ms | 38.5 MB | 1 | 17,720 px | 796 MB |
| 960 | 66,560 | backpack | 21,419 ms | 38.0 MB | 5 | 4,091 px | 680 MB |
| 960 | 66,560 | backpack, trimmed | 15,817 ms | 40.5 MB | 2 | 4,096 px | 721 MB |
| 1098 | 338,944 | spriter 0.2 | 214,428 ms | 78.7 MB | 1 | 90,221 px | 3,322 MB |
| 1098 | 338,944 | backpack | 95,509 ms | 76.5 MB | 23 | 4,091 px | 2,054 MB |
| 1098 | 338,944 | backpack, trimmed | 50,871 ms | 83.1 MB | 6 | 4,096 px | 2,066 MB |

## Reading the numbers

- **Lossless:** decoding the pages gives back every sprite pixel for pixel, trimmed or not (`tests/backpack-sprites.local.ts`, 772 and 1098).
- **Pages fit a GPU texture.** From 8.60 on, spriter's single sheet is taller than the 16,384 px most GPUs accept.
- **Trimming** packs fewer pixels (6 pages instead of 23 on the 1098) and is faster, but the PNGs are 4-9% larger: sprites from unrelated items end up side by side and compress worse. It stays off by default.
- **Where the time goes** (772, one page): drawing the page 0.1 s, choosing the PNG filter of each row 2.0 s, deflate 1.7 s. Choosing filters started at 3.4 s; one specialized loop per filter brought it down.
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
