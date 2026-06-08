# Output schemas

paradox-toolkit produces two structured JSON artifacts: `content.json` (from `@paradoxlab/thinger`) and `positions.json` (from `@paradoxlab/spriter`). This document describes both formats for consumers who read them at runtime - including non-TypeScript environments like game servers or web tooling.

TypeScript consumers can import the TypeBox schemas and version constants directly:

```ts
import { ContentJsonSchema, CONTENT_SCHEMA_VERSION } from '@paradoxlab/thinger'
import { SpritesheetJsonSchema, SPRITESHEET_SCHEMA_VERSION } from '@paradoxlab/spriter'
```

---

## Versioning

Both schemas carry a `meta.schema` string (e.g. `"1.0.0"`) that follows semver independently from the package version.

- **Consumers should reject files whose `meta.schema` they do not recognize.**
- A new package version may ship without changing the schema version.
- A patch release that changes the JSON shape **must** bump the schema version.

---

## `content.json`

Produced by `Thinger({ dat, otb }).build()`. Merges DAT visual data with OTB gameplay metadata into a single typed structure per client ID.

### Top-level shape

```json
{
  "meta": { ... },
  "items": [ ... ],
  "creatures": [ ... ],
  "effects": [ ... ],
  "missiles": [ ... ]
}
```

### `meta`

| Field | Type | Description |
|---|---|---|
| `schema` | `string` | Schema version - reject if unrecognized |
| `version` | `number` | Tibia client version (e.g. `772`) |
| `dat` | `string` | DAT signature as uppercase hex (e.g. `"439D5A33"`) |
| `otb` | `string` | OTB schema version string |
| `counts.items` | `number` | Number of item entries |
| `counts.creatures` | `number` | Number of creature entries |
| `counts.effects` | `number` | Number of effect entries |
| `counts.missiles` | `number` | Number of missile entries |

### `items[]` - `ItemContentDef`

Each entry has a client ID, a name (from the built-in name map), and two sub-objects:

```json
{
  "id": 100,
  "name": "Stone",
  "gameplay": { ... },
  "visual": { ... }
}
```

#### `gameplay`

All fields are always present. Boolean flags default to `false` when the DAT flag is absent.

| Field | Type | Description |
|---|---|---|
| `walkable` | `boolean` | Tile can be walked over |
| `blocksSight` | `boolean` | Blocks line of sight |
| `blocksMissile` | `boolean` | Blocks projectiles |
| `blockPathfinder` | `boolean` | Excluded from auto-walk |
| `groundSpeed` | `number` | Movement cost when item is ground tile; `0` otherwise |
| `fullGround` | `boolean` | Ground tile covers the full cell |
| `container` | `boolean` | Can hold other items |
| `stackable` | `boolean` | Items of this type can stack |
| `moveable` | `boolean` | Can be moved by players |
| `pickupable` | `boolean` | Can be picked up |
| `useable` | `boolean` | Has a use action |
| `forceUse` | `boolean` | Auto-use on step |
| `multiUse` | `boolean` | Use-with action |
| `readable` | `boolean` | Has readable text |
| `allowDistRead` | `boolean` | Text readable from a distance |
| `writable` | `{ length: number } \| null` | Writable with max text length; `null` if not writable |
| `writableOnce` | `{ length: number } \| null` | Write-once variant |
| `fluidContainer` | `boolean` | Holds fluids |
| `fluid` | `boolean` | Is a fluid splash |
| `cannotDecay` | `boolean` | Item does not decay |
| `floorChange` | `boolean` | Changes floor level |
| `floorChangeDown/North/East/South/West` | `boolean` | Directional floor transitions |
| `hangable` | `boolean` | Can be hung on a wall |
| `hookEast` / `hookSouth` | `boolean` | Wall hook direction |
| `vertical` / `horizontal` | `boolean` | Hangs on vertical / horizontal surface |
| `rotatable` | `boolean` | Can be rotated |
| `rotateTo` | `number \| null` | Client ID of the rotated form; `null` if not rotatable |
| `alwaysOnTop` | `boolean` | Always rendered on top |
| `alwaysOnTopOrder` | `number` | Z-order among always-on-top items |
| `isAnimation` | `boolean` | Has sprite animation |
| `clientCharges` | `boolean` | Client tracks charge count |
| `clientDuration` | `boolean` | Client tracks duration |
| `ignoreLook` | `boolean` | Look action skips this item |
| `weight` | `number` | Item weight in oz |
| `maxItems` | `number` | Max items in container; `0` otherwise |
| `maxWriteLength` | `number` | Maximum writable text length; `0` otherwise |
| `description` | `string` | Item description string |
| `minimapColor` | `number \| null` | Minimap dot color; `null` if absent |
| `lensHelp` | `number \| null` | Lens help value; `null` if absent |

#### `visual`

| Field | Type | Description |
|---|---|---|
| `spriteIds` | `number[]` | Ordered list of sprite IDs; length = `width × height × layers × patternX × patternY × patternZ × frames` |
| `layout` | `ThingLayout` | Sprite grid dimensions - see below |
| `light` | `{ level: number, color: number } \| null` | Emitted light; `null` if item does not emit light |
| `elevation` | `number` | Tile elevation added by this item; `0` if none |
| `stackOrder` | `StackOrder` | Rendering layer - see below |
| `offset` | `{ x: number, y: number } \| null` | Draw offset in pixels; `null` if none |
| `lyingObject` | `boolean` | Rendered flat on the ground |
| `alwaysAnimate` | `boolean` | Sprite animates even when tile is off-screen |
| `dontHide` | `boolean` | Not hidden by roofs or similar |
| `translucent` | `boolean` | Rendered with transparency |
| `noMoveAnimation` | `boolean` | Does not animate during movement |

#### `ThingLayout`

| Field | Description |
|---|---|
| `width`, `height` | Sprite grid dimensions in 32 px cells |
| `layers` | Number of color layers |
| `patternX`, `patternY`, `patternZ` | Pattern repetitions per axis |
| `frames` | Animation frame count |
| `realSize` | Raw size byte from the DAT file |
| `exactSize` | `min(realSize, max(width × 32, height × 32))` |

#### `StackOrder`

Controls the rendering layer on a tile:

| Value | Description |
|---|---|
| `"ground"` | Ground tile |
| `"border"` | Ground decoration drawn on top of the ground |
| `"bottom"` | Always rendered below other objects |
| `"top"` | Always rendered above other objects |
| `"regular"` | Standard stacking order |

### `creatures[]`, `effects[]`, `missiles[]` - `VisualOnlyDef`

These groups carry visual data only - no gameplay metadata.

```json
{
  "id": 1,
  "visual": {
    "spriteIds": [101, 102, 103, 104],
    "layout": { "width": 2, "height": 2, "layers": 1, "patternX": 4, "patternY": 4, "patternZ": 1, "frames": 3, "realSize": 64, "exactSize": 64 },
    "light": null
  }
}
```

---

## `positions.json`

Produced by `Spriter({ spr }).build()`. Maps every sprite ID to its top-left pixel coordinate inside the generated spritesheet PNG.

### Top-level shape

```json
{
  "meta": { ... },
  "positions": {
    "1": { "x": 0, "y": 0 },
    "2": { "x": 33, "y": 0 }
  }
}
```

### `meta`

| Field | Type | Description |
|---|---|---|
| `schema` | `string` | Schema version - reject if unrecognized |
| `version` | `number` | Tibia client version (e.g. `772`) |
| `spr` | `string` | SPR signature as uppercase hex |
| `width` | `number` | Spritesheet width in pixels |
| `height` | `number` | Spritesheet height in pixels |
| `sprites` | `number` | Total number of sprites packed |

### `positions`

A plain object keyed by sprite ID (as a string). Each value is the **top-left corner** of the sprite's 32 × 32 pixel region within the spritesheet.

Sprites are packed left-to-right, top-to-bottom with 1 px padding between cells. A sprite at position `{ x, y }` occupies pixels `[x, x+31]` × `[y, y+31]` in the PNG.

---

## Using `content.json` and `positions.json` together

`spriteIds` in `content.json` index directly into `positions.json`. To render item 100 at animation frame 0:

1. Look up item 100 in `content.json` → read `visual.spriteIds[0]`
2. Look up that sprite ID in `positions.json` → get `{ x, y }`
3. Sample the 32 × 32 region at `(x, y)` from the spritesheet PNG

The `visual.layout` fields describe how many sprites an item has and in what order (`width × height × layers × patternX × patternY × patternZ × frames`). Sprite selection for a given draw state follows the standard Tibia client formula.
