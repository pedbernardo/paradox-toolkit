# Binary formats

This document describes the on-disk layout of the four binary formats parsed and written by paradox-toolkit: `.dat`, `.spr`, `items.otb`, and `.otbm`. It is intended as a reference for contributors and for consumers who need to understand what the parsers produce and why.

All multi-byte integers are **little-endian** unless otherwise noted.

---

## Table of contents

- [DAT - Thing definitions](#dat---thing-definitions)
- [SPR - Sprite image data](#spr---sprite-image-data)
- [OTB - Item metadata](#otb---item-metadata)
- [OTBM - Map data](#otbm---map-data)
- [Shared primitives](#shared-primitives)

---

## DAT - Thing definitions

Parsed and written by `@paradoxlab/dat`.

The `.dat` file stores visual and layout definitions for every entity the client can render: items, creatures, effects, and missiles. Each entry is called a **thing**. Things are grouped by category and identified by their **client ID** (CID).

### Header

The file begins with a 12-byte header:

| Offset | Size | Type | Description |
|--------|------|------|-------------|
| 0 | 4 | u32 | Magic signature (version-specific, see below) |
| 4 | 2 | u16 | `itemsMaxCid` - highest item client ID |
| 6 | 2 | u16 | Creature count |
| 8 | 2 | u16 | Effect count |
| 10 | 2 | u16 | Missile count |

The parser rejects the file if the magic signature does not match the expected value for the declared version. Items occupy CIDs 100 through `itemsMaxCid`; the actual item count is `itemsMaxCid - 99`. Creatures, effects, and missiles use IDs 1 through their respective count.

**Magic signatures by version:**

| Version | Signature |
|---------|-----------|
| 710 | `0x3DFF4B2A` |
| 740 | `0x41BF619C` |
| 750 | `0x42F81973` |
| 755 | `0x437B2B8F` |
| 760, 770, 772 | `0x439D5A33` |
| 860 | `0x4C28B721` |
| 870 | `0x4CFE22C5` |
| 960 | `0x4FFA74CC` |
| 980 | `0x50C70674` |
| 1098 | `0x000042A3` |

### Thing record structure

Following the header, thing records are written sequentially with no separators. Each record has three sections:

1. **Flags** — variable-length, terminated by a sentinel byte
2. **Layout** — fixed structure describing the sprite grid
3. **Sprite IDs** — array of IDs whose length is derived from the layout dimensions

#### 1. Flags

Flags are read as a sequence of u8 bytes until the sentinel is reached. The sentinel byte value is `0xFF` in all versions prior to 755 and `0x00` in v755 and later.

Each non-sentinel byte maps to a named flag. The mapping is **version-dependent** — the same byte value means different things across versions. Some flags carry additional payload bytes:

| Payload | Flags that use it |
|---------|-------------------|
| none | Most boolean flags (`STACKABLE`, `CONTAINER`, `PICKUPABLE`, etc.) |
| u16 | `GROUND` (speed), `MINIMAP` (color), `LIGHT_INFO.level`, `WRITABLE` / `WRITABLE_ONCE` (max length), `LENS_HELP`, `CLOTH` (slot), `USABLE`, `ROTATETO` (v860+) |
| u16 + u16 | `LIGHT_INFO` (level, color), `HAS_OFFSET` (offsetX, offsetY, v760+), `HAS_ELEVATION` (height, plus second u16) |
| complex | `MARKET` (v960+): u16 category + u16 tradeAs + u16 showAs + u16 nameLen + string + u16 restrictVocation + u16 requiredLevel |

Flag positions shifted significantly across the major version breakpoints: v710, v740/750, v755, and v860. The `@paradox/dat` package resolves the correct mapping via `getVersionFeatures`.

#### 2. Layout

The layout section immediately follows the flags sentinel:

| Field | Size | Condition |
|-------|------|-----------|
| width | u8 | always |
| height | u8 | always |
| realSize | u8 | only when width > 1 or height > 1 |
| layers | u8 | always |
| patternX | u8 | always |
| patternY | u8 | always |
| patternZ | u8 | v755+ only; hardcoded to 1 in earlier versions |
| frames | u8 | always |

When the `frameDurations` feature is active (v1030+) and `frames > 1`, the layout is followed by animation timing data:

| Field | Size | Description |
|-------|------|-------------|
| async | u8 | 1 = asynchronous animation |
| loopCount | i32 | Signed; -1 means loop indefinitely |
| startPhase | i8 | Signed starting frame |
| durations | u32 × u32 × frames | Min and max duration in milliseconds per frame |

When the `frameGroups` feature is active (v1090+), creatures carry multiple layout blocks — one per animation group (idle, moving, etc.) — each prefixed by a u8 group type.

#### 3. Sprite IDs

The sprite ID array length is: `width × height × layers × patternX × patternY × patternZ × frames`.

Each entry is:
- **u32** when the `extendedSprites` feature is active (v960+)
- **u16** in all earlier versions

---

## SPR - Sprite image data

Parsed and written by `@paradoxlab/spr`.

The `.spr` file stores 32×32 pixel sprite images using run-length encoding (RLE). Sprites are indexed by a 1-based ID. The file has a small header, a flat address table, and a variable-length data section.

### Header

| Offset | Size | Type | Condition | Description |
|--------|------|------|-----------|-------------|
| 0 | 4 | u32 | always | Magic signature (version-specific, see below) |
| 4 | 4 | u32 | v960+ | Sprite count |
| 4 | 2 | u16 | before v960 | Sprite count |

**Magic signatures by version:**

| Version | Signature |
|---------|-----------|
| 710 | `0x3DFF4AEB` |
| 740 | `0x41B9EA86` |
| 750 | `0x42F81949` |
| 755 | `0x434F9CDE` |
| 760, 770, 772 | `0x439852BE` |
| 860 | `0x4C220594` |
| 870 | `0x4CFD078A` |
| 960 | `0x4FFA74F9` |
| 980 | `0x50C70753` |
| 1098 | `0x57BBD603` |

### Address table

Immediately after the header, there are N entries (one per sprite, 1-based) each holding a u32 file offset:

- **0** means the sprite slot is empty; the parser returns a fully transparent 32×32 image.
- Any other value is the absolute byte offset of the sprite's data block within the file.

The table starts at offset 6 (before v960) or offset 8 (v960+), consistent with the header size difference.

### Sprite data block

Each non-empty sprite is stored as follows:

| Offset | Size | Description |
|--------|------|-------------|
| 0 | 3 | Color key (typically `0xFF 0x00 0xFF`) — ignored by the parser |
| 3 | 2 (u16) | Byte length of the RLE pixel data that follows |
| 5 | variable | RLE pixel runs |

#### RLE encoding

The pixel data encodes a 32×32 = 1024-pixel image scanned left-to-right, top-to-bottom. Each run is:

| Field | Size | Description |
|-------|------|-------------|
| transparent count | u16 | Number of transparent pixels to emit |
| colored count | u16 | Number of colored pixels that follow |
| pixels | 3 × colored count | R, G, B bytes for each colored pixel (no alpha stored) |

Transparent pixels output as RGBA `(0, 0, 0, 0)`; colored pixels output as RGBA `(R, G, B, 255)`. Trailing transparent pixels at the end of the 1024-pixel sequence may be omitted.

---

## OTB - Item metadata

Parsed and written by `@paradoxlab/otb`.

The `items.otb` file stores server-side item metadata: server IDs, gameplay flags, and attributes such as name, weight, and speed. Unlike the DAT format, OTB uses a **node-tree structure** where every node is delimited by special marker bytes.

### Marker bytes and escape encoding

Three byte values are reserved as structural markers:

| Value | Meaning |
|-------|---------|
| `0xFE` | Node start |
| `0xFF` | Node end |
| `0xFD` | Escape prefix |

Any payload byte with a value of `0xFD`, `0xFE`, or `0xFF` must be escaped: written as `[0xFD, originalByte]`. The reader strips the escape prefix and returns the original byte. This applies to all data read after header magic bytes.

### File layout

```
[0x00 0x00 0x00 0x00]   4-byte magic
[0xFE]                  root node start
  [0x00]                root group type
  [escU32: flags]       root flags (always 0)
  [0x01]                attribute ID = ROOT_NODE_ATTR
  [escU16: 128]         attribute data length
  [escU32: major]       OTB schema major version
  [escU32: minor]       OTB schema minor version
  [escU32: build]       OTB schema build version
  [116 bytes: padding]  zero-filled
  [item nodes...]       one per item
[0xFF]                  root node end
```

Supported schema major versions: 1, 2, 3.

### Item node

```
[0xFE]              node start
[group: u8]         item group (see below)
[escU32: flags]     27-bit gameplay flag bitmask
[attributes...]     TLV-encoded attributes
[0xFF]              node end
```

Items with group `14` (DEPRECATED) are silently skipped during parsing.

**Item groups:**

| Value | Name |
|-------|------|
| 0 | NONE |
| 1 | GROUND |
| 2 | CONTAINER |
| 3 | WEAPON |
| 4 | AMMUNITION |
| 5 | ARMOR |
| 6 | RUNE |
| 7 | TELEPORT |
| 8 | MAGICFIELD |
| 9 | WRITABLE |
| 10 | KEY |
| 11 | SPLASH |
| 12 | FLUID |
| 13 | DOOR |
| 14 | DEPRECATED |

**Flags bitmask (27 bits):**

| Bit | Flag |
|-----|------|
| 0 | UNPASSABLE |
| 1 | BLOCK_MISSILES |
| 2 | BLOCK_PATHFINDER |
| 3 | HAS_ELEVATION |
| 4 | USEABLE |
| 5 | PICKUPABLE |
| 6 | MOVEABLE |
| 7 | STACKABLE |
| 8 | FLOOR_CHANGE_DOWN |
| 9 | FLOOR_CHANGE_NORTH |
| 10 | FLOOR_CHANGE_EAST |
| 11 | FLOOR_CHANGE_SOUTH |
| 12 | FLOOR_CHANGE_WEST |
| 13 | ALWAYS_ON_TOP |
| 14 | READABLE |
| 15 | ROTABLE |
| 16 | HANGABLE |
| 17 | HOOK_EAST |
| 18 | HOOK_SOUTH |
| 19 | CANNOT_DECAY |
| 20 | ALLOW_DIST_READ |
| 21 | CLIENT_DURATION |
| 22 | CLIENT_CHARGES |
| 23 | IGNORE_LOOK |
| 24 | IS_ANIMATION |
| 25 | FULL_GROUND |
| 26 | FORCE_USE |

Items with group RUNE (6) automatically have `CLIENT_CHARGES` set to true regardless of the bitmask.

### Attributes (TLV)

Each attribute uses a type-length-value layout:

```
[attrId: u8]       attribute type
[escU16: length]   byte length of the value that follows
[data: length bytes]
```

Unknown attribute IDs are skipped. The escape encoding applies to `length` and all data bytes.

**Attribute type IDs:**

| ID | Name | Value format |
|----|------|--------------|
| 16 | SERVERID | u16 |
| 17 | CLIENT_ID | u16 |
| 18 | NAME | string (latin-1) |
| 19 | DESCRIPTION | string (latin-1) |
| 20 | SPEED | u16 |
| 22 | MAXITEMS | u16 |
| 23 | WEIGHT | u64 |
| 30 | ROTATETO | u16 |
| 32 | SPRITEHASH | bytes |
| 33 | MINIMAPCOLOR | u16 |
| 34 | MAX_WRITE_LENGTH | u16 |
| 35 | MAX_READ_LENGTH | u16 |
| 36 | LIGHT | u16 level + u16 color |
| 42 | LIGHT2 | u16 level + u16 color (preferred over LIGHT) |
| 43 | TOPORDER | u8 |
| 45 | WAREID | u16 |
| 46 | CLASSIFICATION | u8 |

When attribute 16 (SERVERID) is absent, the parser auto-assigns a server ID sequentially starting from 100.

---

## OTBM - Map data

Parsed and written by `@paradoxlab/otbm`.

The `.otbm` file stores the complete game map as a binary tree of nodes. It uses the same marker/escape mechanism as OTB (`0xFE`, `0xFF`, `0xFD`). The map is divided into **tile areas** (256×256 coordinate blocks), each containing individual tiles. Tiles hold gameplay attributes and can nest item nodes recursively.

### File layout

```
[u32: magic]            file format version (0–3)
[0xFE 0x00]             root node start (WORLD_NODE type)
  [escU32: worldVer]    expected value: 2
  [escU16: mapWidth]    map width in tiles
  [escU16: mapHeight]   map height in tiles
  [escU32: tibiaMajor]  Tibia major version
  [escU32: tibiaMinor]  Tibia minor version
  [child nodes...]
[0xFF]                  root node end
```

### Node types

Every node starts with `0xFE`, followed by a u8 type byte, followed by property bytes, followed by child nodes, and terminated by `0xFF`.

| Type byte | Name | Contents |
|-----------|------|----------|
| `0x00` | WORLD_NODE | root; contains MAP_DATA, TOWNS, WAYPOINTS |
| `0x02` | MAP_DATA | container; contains TILE_AREAs |
| `0x04` | TILE_AREA | area header + TILE/HOUSETILE children |
| `0x05` | TILE | tile position + attributes + ITEM children |
| `0x06` | ITEM | item SID + attributes + nested ITEM children |
| `0x0C` | TOWNS | container; contains TOWN children |
| `0x0D` | TOWN | town ID, name, and temple position |
| `0x0E` | HOUSETILE | like TILE but with a house ID |
| `0x0F` | WAYPOINTS | container; contains WAYPOINT children (v2+) |
| `0x10` | WAYPOINT | name and position (v2+) |

**Node hierarchy:**

```
WORLD_NODE
├─ MAP_DATA
│  └─ TILE_AREA (one per 256×256 chunk)
│     ├─ TILE
│     │  └─ ITEM (recursive — items can contain items)
│     └─ HOUSETILE
│        └─ ITEM
├─ TOWNS
│  └─ TOWN
└─ WAYPOINTS  (v2+)
   └─ WAYPOINT
```

### TILE_AREA properties

| Field | Type | Description |
|-------|------|-------------|
| baseX | escU16 | Absolute X coordinate of the area's top-left corner |
| baseY | escU16 | Absolute Y coordinate |
| baseZ | escU8 | Floor level |

Tile coordinates within the area are stored as u8 offsets relative to these base values.

### TILE and HOUSETILE properties

**TILE:**

| Field | Type |
|-------|------|
| offsetX | escU8 |
| offsetY | escU8 |

**HOUSETILE** — same as TILE, plus:

| Field | Type |
|-------|------|
| houseId | escU32 |

Both node types then carry TLV attributes until the first child node or `0xFF`.

**Tile attributes:**

| ID | Name | Value |
|----|------|-------|
| `0x03` | TILE_FLAGS | escU32 bitmask |
| `0x04` | ACTION_ID | escU16 |
| `0x09` | ITEM | escU16 SID (compact inline item) |

**Tile flags bitmask:**

| Bit | Flag |
|-----|------|
| 0 | PROTECTION_ZONE |
| 2 | NO_PVP |
| 3 | NO_LOGOUT |
| 4 | PVP_ZONE |
| 5 | REFRESH |

### ITEM node

Items carry a server ID and optional attributes. Items with no attributes and no children can be serialized as a compact inline tile attribute (`0x09`); all others are written as full nodes.

```
[0xFE 0x06]         node start
[escU16: sid]       server item ID
[attributes...]     TLV-encoded (see below)
[child ITEMs...]    recursive; containers and doors can hold items
[0xFF]              node end
```

**Item attributes:**

| ID | Name | Value |
|----|------|-------|
| `0x04` | ACTION_ID | escU16 |
| `0x05` | UNIQUE_ID | escU16 |
| `0x06` | TEXT | escU16 length + string |
| `0x07` | DESC | escU16 length + string |
| `0x08` | TELE_DEST | escU16 x + escU16 y + escU8 z |
| `0x0A` | DEPOT_ID | escU16 |
| `0x0C` | RUNE_CHARGES | escU8 |
| `0x0E` | HOUSE_DOOR | escU8 |
| `0x0F` | COUNT | escU8 |
| `0x10` | DURATION | escU32 |
| `0x11` | DECAY_STATE | escU8 |
| `0x12` | WRITTEN_DATE | escU32 |
| `0x13` | WRITTEN_BY | escU16 length + string |
| `0x14` | SLEEPER_GUID | escU32 (read and discarded) |
| `0x15` | SLEEP_START | escU32 (read and discarded) |
| `0x16` | CHARGES | escU16 |
| `0x80` | ATTRIBUTE_MAP | extended attributes (v4+) |

### TOWN node

```
[escU32: townId]
[escU16 + string: name]
[escU16: templeX]
[escU16: templeY]
[escU8: templeZ]
```

### WAYPOINT node (v2+)

```
[escU16 + string: name]
[escU16: x]
[escU16: y]
[escU8: z]
```

---

## Shared primitives

All four parsers are built on `createBinaryReader` and `createBinaryWriter` from `@paradoxlab/utils`. These wrap a `Uint8Array` and expose typed read/write methods — no `DataView` or manual byte arithmetic in package code.

The escaped variants (`EscapedBinaryReader`, `EscapedBinaryWriter`) add `escU8`, `escU16`, `escU32`, and `escU64` methods that transparently apply the OTB/OTBM escape mechanism.

**String encoding:** Latin-1 (ISO-8859-1) via a module-level `TextDecoder` constant. Strings in OTB and OTBM are prefixed by a u16 length.

**Version features** (`getVersionFeatures` from `@paradoxlab/utils`) maps each supported client version to a set of boolean flags that the DAT and SPR parsers consult to decide field presence, array element sizes, and flag byte positions. Calling it with an unsupported version throws `UnsupportedVersionError`.
