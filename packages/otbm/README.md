# @paradoxlab/otbm

[![npm](https://img.shields.io/npm/v/@paradoxlab/otbm.svg)](https://www.npmjs.com/package/@paradoxlab/otbm)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](../../LICENSE)

Parser and writer for OTServers `.otbm` binary map format. Reads tile areas, towns, waypoints, and map metadata from TFS-compatible map files.

## Installation

```bash
npm install @paradoxlab/otbm
```

## How to Use

```ts
import { readFileSync, writeFileSync } from 'node:fs'
import { Otbm } from '@paradoxlab/otbm'

// Parse
const file = Otbm().load(readFileSync('world.otbm'))

// Access header
const { version, width, height, description } = file.header
console.log(`${width}x${height} map - ${description}`)

// Look up a tile
const tile = file.getTile(100, 200, 7)
// → { pos: { x: 100, y: 200, z: 7 }, ground: 4526, items: [...] } | undefined

// Iterate tile areas
for (const area of file.areas) {
  for (const tile of area.tiles) {
    console.log(tile.pos.x, tile.pos.y, tile.pos.z, tile.ground)
  }
}

// Towns and waypoints
for (const town of file.towns) {
  console.log(town.id, town.name, town.templePos)
}
for (const wp of file.waypoints) {
  console.log(wp.name, wp.pos)
}

// Write back to binary (round-trip)
writeFileSync('out.otbm', Otbm().write(file))

// Validate without loading
const result = Otbm().validate(readFileSync('world.otbm'))
// → { ok: true } | { ok: false, error: string }
```

## API

### `Otbm(opts?: OtbmOptions)`

Factory returning `{ load, write, validate }`.

```ts
type OtbmOptions = {
  mapVersion?: number  // override auto-detected map version
}
```

### `.load(buffer: ArrayBuffer | Uint8Array): OtbmFile`

Parse an `.otbm` binary. Throws `ParseError` on malformed input.

### `.write(data: OtbmWriteInput): Uint8Array`

Serialize an `OtbmFile` (or compatible object) back to binary.

### `.writeStream(data: OtbmWriteInput, opts?: OtbmWriteOpts): AsyncIterable<Uint8Array>`

Streaming variant of `.write()`. Yields the output as an array of `Uint8Array` chunks suitable for piping to a writable stream.

> **Note:** the full serialization is performed synchronously before the first yield — memory usage at peak is equivalent to `.write()`. The chunk-by-chunk delivery is useful for progressive writes (e.g., piping to `fs.createWriteStream`), but does not reduce peak memory allocation.
>
> TODO: implement incremental serialization (generate and yield each area without full upfront accumulation)

### `.validate(buffer: ArrayBuffer | Uint8Array): { ok: boolean; error?: string }`

Validate the root node marker and header version without parsing areas.

### `OtbmFile`

| Property | Type | Description |
|---|---|---|
| `header` | `OtbmHeader` | `{ version, width, height, itemsMajorVersion, itemsMinorVersion, description }` |
| `areas` | `OtbmArea[]` | Tile areas (16×16 blocks with a base position) |
| `towns` | `OtbmTown[]` | `{ id, name, templePos: { x, y, z } }` |
| `waypoints` | `OtbmWaypoint[]` | `{ name, pos: { x, y, z } }` |
| `.getTile(x, y, z)` | `OtbmTile \| undefined` | Look up a tile by world position |

### `OtbmTile`

| Property | Type | Description |
|---|---|---|
| `pos` | `{ x, y, z }` | World position |
| `ground` | `number \| undefined` | Ground item server ID |
| `flags` | `OtbmTileFlags` | `protectionZone`, `noLogout`, `pvpZone`, ... |
| `items` | `OtbmItem[]` | Items stacked on the tile |

## Format Notes

- Like OTB, OTBM uses an escaped binary tree: node boundaries are `0xFE` (start) and `0xFF` (end); `0xFD` escapes reserved bytes within data.
- Tile positions are stored relative to each area's base position (the area header stores the base `x, y, z`, individual tiles store `dx, dy` offsets). `getTile()` reconstructs absolute positions transparently.
- Map versions differ in which node types and attribute IDs are supported. The parser reads the version from the root header and adjusts accordingly.

---

[← Back to paradox-toolkit](../../README.md)
