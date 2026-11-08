# Output schemas

paradox-toolkit produces structured JSON artifacts for consumers that read them at runtime, including non-TypeScript environments like game servers or web tooling:

- `content.json` (schema 2.0.0) and `sprites.json` (schema 2.0.0), from `@paradoxlab/backpack`;
- the Asset Pack (schema 1.0.0): `pack.json`, `items.json`, `render.json` and its PNG pages, from `@paradoxlab/backpack`.

---

## Versioning

`content.json` and `sprites.json` carry a `meta.schema` string (e.g. `"2.0.0"`), and an Asset Pack carries `schema` in `pack.json`; both follow semver independently from the package version.

- **Consumers should reject files whose `meta.schema` they do not recognize.**
- A new package version may ship without changing the schema version.
- A patch release that changes the JSON shape **must** bump the schema version.

---

## `content.json` 2.0.0 (`@paradoxlab/backpack`)

Produced by `buildContent({ dat, otb })` or `backpack content`. Tables are **columns**: every field is an array, and row `i` of every array describes the same entry. Optional numbers use `-1` for "none".

```json
{
  "meta": { "schema": "2.0.0", "client": 860, "dat": "4C2C7993", "lineage": { "otbMajor": 3, "otbMinor": 20 } },
  "items": { "sid": [100, 101], "cid": [100, 101], "name": ["", ""], "flags": [3, 3], "...": [] },
  "appearances": { "cid": [100, 101], "width": [1, 1], "spriteStart": [0, 1], "spriteIds": [1, 2], "...": [] },
  "creatures": { "...": [] },
  "effects": { "...": [] },
  "missiles": { "...": [] }
}
```

### `meta`

| Field | Type | Description |
|---|---|---|
| `schema` | `string` | `"2.0.0"` |
| `client` | `number` | Client version of the DAT (e.g. `860`) |
| `dat` | `string` | DAT signature, 8 hex digits |
| `lineage` | `{ otbMajor, otbMinor }` or `null` | OTB version the sids belong to; `null` without an OTB, and then every item has sid = cid |

### `items`: one row per sid

Every OTB entry is an item; items that share a client id keep their own sid. Gameplay comes from the OTB, with the DAT flags as fallback.

| Column | Description |
|---|---|
| `sid`, `cid` | Server id and client id |
| `name`, `description` | From the OTB, or a bundled name list by client id |
| `flags` | `ItemFlag` bits (below) |
| `floorChange` | `FloorChange` bits: any (1), down (2), north (4), east (8), south (16), west (32) |
| `groundSpeed`, `weight`, `maxItems`, `maxWriteLength`, `alwaysOnTopOrder` | Numbers, 0 when absent |
| `writableLength`, `writableOnceLength`, `rotateTo`, `minimapColor`, `lensHelp` | Numbers, -1 when absent |
| `appearance` | Row in `appearances`, or -1 when the client has no thing for the cid |

`ItemFlag` bits, from bit 0: walkable, blocks missile (and sight: no client file tells them apart), blocks pathfinder, full ground, container, stackable, moveable, pickupable, useable, force use, multi use, readable, allow distance read, fluid container, fluid, cannot decay, hangable, hook east, hook south, vertical, horizontal, rotatable, always on top, is animation, client charges, client duration, ignore look. The constants are exported as `ItemFlag` and `FloorChange`, with `StackOrder` and `AppearanceFlag`, from the package root, `/content` and `/load`.

### `appearances`, `creatures`, `effects`, `missiles`: one row per client id

| Column | Description |
|---|---|
| `cid` | Client id |
| `width`, `height`, `layers`, `patternX`, `patternY`, `patternZ`, `frames` | Sprite layout, as the DAT defines it |
| `spriteStart`, `spriteIds` | The row's sprites are `spriteIds[spriteStart[i] .. spriteStart[i + 1]]` (to the end for the last row), in DAT order (see `spriteIndex` in `@paradoxlab/appearance`) |
| `order` | `StackOrder`: ground (0), border (1), bottom (2), top (3), common (4) |
| `elevation`, `offsetX`, `offsetY` | Pixels |
| `lightLevel`, `lightColor` | 0 for no light |
| `flags` | `AppearanceFlag` bits: lying object (1), always animate (2), don't hide (4), translucent (8), no move animation (16) |

---

## `sprites.json` 2.0.0 (`@paradoxlab/backpack`)

Produced by `buildSpriteSheet(spr, options)` or `backpack sprites`, next to PNG pages `sprites-0.png`, `sprites-1.png`, …

```json
{
  "meta": {
    "schema": "2.0.0",
    "client": 860,
    "spr": "4C220594",
    "pages": [{ "width": 4091, "height": 4091 }],
    "sprites": 36386
  },
  "frames": { "id": [1, 2], "page": [0, 0], "x": [0, 33], "y": [0, 0], "w": [32, 32], "h": [32, 32], "offsetX": [0, 0], "offsetY": [0, 0] }
}
```

| `frames` column | Description |
|---|---|
| `id` | Sprite id |
| `page` | Index of the PNG page; -1 for a sprite left empty by trimming |
| `x`, `y`, `w`, `h` | Rectangle in the page; `w = h = 0` for an empty sprite |
| `offsetX`, `offsetY` | Where the rectangle was inside the 32×32 sprite (0 unless trimmed) |

---

## Asset Pack 1.0.0 (`@paradoxlab/backpack`)

Produced by `buildPack(options)` and `writePack(dir, pack)`, or `backpack build`; read by `loadPack` from `@paradoxlab/backpack/load`, which turns the columns into typed arrays and refuses another major schema. Tables are columns, as in `content.json`.

| File | Content |
|---|---|
| `pack.json` | The manifest, read first |
| `items.json` | Item columns, one row per sid |
| `render.json` | Composed appearances and the frame table |
| `page-N.png` | Atlas pages (8-bit RGBA, lossless), named in the manifest |

### `pack.json`

| Field | Type | Description |
|---|---|---|
| `schema` | `string` | `"1.0.0"` |
| `client` | `number` | Client version (e.g. `860`) |
| `dat`, `spr` | `string` | DAT and SPR signatures, 8 hex digits |
| `lineage` | `{ otbMajor, otbMinor }` or `null` | OTB version the sids belong to; `null` without an OTB (sid = cid). Compare it with the OTB version in an OTBM header with `checkCompatibility` |
| `pages` | `{ file, width, height }[]` | Atlas pages, at most `maxPageSize` (4096) on each side |
| `counts` | `{ items, appearances, frames }` | Rows in each table; `frames` includes frame 0 |

### `items.json`

The `items` columns of `content.json` (same fields, flags and `-1` convention), with one difference: `appearance` is the row in `render.json`, which holds only the appearances some item uses. A loader derives sid → appearance from `sid` and `appearance`; no separate table ships.

### `render.json`

```json
{
  "appearances": { "cid": [100, 101], "width": [1, 1], "frameStart": [0, 1], "frameIds": [1, 2], "opaque": [1, 0], "...": [] },
  "frames": { "page": [-1, 0, 0], "x": [0, 0, 33], "y": [0, 0, 0], "w": [0, 32, 4], "h": [0, 32, 4], "offsetX": [0, 0, 2], "offsetY": [0, 0, 2] }
}
```

`appearances`: one row per client id an item uses, with every layer composed into one image.

| Column | Description |
|---|---|
| `cid` | Client id |
| `width`, `height`, `patternX`, `patternY`, `patternZ`, `frames` | Sprite layout with `layers` = 1 |
| `frameStart`, `frameIds` | Frame per sprite index: `frameIds[frameStart[i] + spriteIndex(layout, …)]` is a row of `frames`; 0 is the empty frame |
| `opaque` | 1 when no frame has a pixel below full alpha (covered tiles can be skipped) |
| `order`, `elevation`, `offsetX`, `offsetY`, `lightLevel`, `lightColor`, `flags` | As in `content.json` appearances |

`frames`: one row per composed frame. Frames with the same layer sprites are shared; grounds and borders are packed first.

| Column | Description |
|---|---|
| `page` | Index in `pages`; -1 for frame 0 |
| `x`, `y`, `w`, `h` | Rectangle in the page, trimmed to the frame's visible pixels |
| `offsetX`, `offsetY` | Where the rectangle sits inside the 32×32 cell |
