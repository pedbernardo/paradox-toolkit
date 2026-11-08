# Output schemas

paradox-toolkit produces structured JSON artifacts for consumers that read them at runtime, including non-TypeScript environments like game servers or web tooling:

- `content.json` (schema 2.0.0) and `sprites.json` (schema 2.0.0), from `@paradoxlab/backpack`.

---

## Versioning

Both schemas carry a `meta.schema` string (e.g. `"2.0.0"`) that follows semver independently from the package version.

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

`ItemFlag` bits, from bit 0: walkable, blocks missile (and sight: no client file tells them apart), blocks pathfinder, full ground, container, stackable, moveable, pickupable, useable, force use, multi use, readable, allow distance read, fluid container, fluid, cannot decay, hangable, hook east, hook south, vertical, horizontal, rotatable, always on top, is animation, client charges, client duration, ignore look. The constants are exported as `ItemFlag` and `FloorChange`.

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
    "spr": "4C2C7993",
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
