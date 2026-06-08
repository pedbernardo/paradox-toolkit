# @paradoxlab/dat

[![npm](https://img.shields.io/npm/v/@paradoxlab/dat.svg)](https://www.npmjs.com/package/@paradoxlab/dat)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](../../LICENSE)

Parser and writer for Tibia's `.dat` binary format. Reads and writes visual/layout definitions for items, creatures, effects, and missiles. Supports Tibia client versions 7.40 - 12.x.

> Note: `.dat` files are proprietary Tibia client assets. Do not redistribute them.

## Installation

```bash
npm install @paradoxlab/dat
```

## How to Use

```ts
import { readFileSync, writeFileSync } from 'node:fs'
import { Dat } from '@paradoxlab/dat'

// Parse
const dat = Dat()                               // auto-detect version from file signature
const file = dat.load(readFileSync('772.dat'))

// Access by group and client ID
const grass = file.get('item', 1)              // { flags, width, height, layers, patterns, ... }
const demon  = file.get('creature', 35)

// Iterate all things
for (const entry of file.entries()) {
  console.log(entry.group, entry.id, entry.thing.flags)
}

// Mutate and write back
file.get('item', 100)!.flags.stackable = true
writeFileSync('out.dat', Dat(772).write(file))

// Validate a buffer without fully loading
const result = Dat(772).validate(readFileSync('772.dat'))
// → { ok: true } | { ok: false, error: string }
```

## API

### `Dat(version?: number)`

Factory that returns a `{ load, write, validate }` object. Pass a version to lock the parser to a specific client; omit it for auto-detection from the file's magic signature.

```ts
const dat = Dat()     // auto-detect
const dat = Dat(772)  // 7.72 client
const dat = Dat(1098) // 10.98 client
```

### `.load(buffer: ArrayBuffer | Uint8Array): DatFile`

Parse a `.dat` binary. Throws `ParseError` on malformed input.

### `.write(data: DatWriteInput): Uint8Array`

Serialize a `DatFile` (or compatible object) back to binary. `DatWriteInput` is structurally compatible with the `DatFile` returned by `.load()`.

### `.validate(buffer: ArrayBuffer | Uint8Array): { ok: boolean; error?: string }`

Check the signature and header without fully parsing all things. Safe to call on untrusted input.

### `DatFile`

| Property | Type | Description |
|---|---|---|
| `version` | `number` | Detected client version |
| `signature` | `number` | 32-bit file signature |
| `counts` | `DatCounts` | `{ items, creatures, effects, missiles }` |
| `things` | `DatThing[]` | Flat array of all things in file order |
| `.get(group, id)` | `DatThing \| undefined` | Look up by group and client ID |
| `.entries()` | `Iterable<{ group, id, thing }>` | Iterate all things with their group and ID |

### `DatThing`

Every entry exposes the standard layout properties plus a `flags` object:

| Property | Description |
|---|---|
| `flags` | Boolean flags (`stackable`, `container`, `unpassable`, `animated`, ...) |
| `width` / `height` | Sprite grid dimensions in 32-px tiles |
| `layers` | Number of renderer layers (e.g. 2 = body + mount) |
| `patternX` / `patternY` / `patternZ` | Pattern counts per axis |
| `frames` | Animation frame count |
| `lightLevel` / `lightColor` | Light source properties |
| `displacement` | `{ x, y }` rendering offset |
| `elevation` | Height for stacking/3D offset |

## Format Notes

- The signature at offset 0 encodes the client version as a packed integer. Auto-detection reads it; explicit version bypasses the check.
- A [known bug](https://github.com/slavidodo/tibia-dat-parser/issues/1) in some OTServer tools wrote the items section using an `ArrayBuffer` offset that caused silent truncation. This parser is unaffected — it reads the full block.
- Flags are split into "simple" (single-byte flags at fixed bit positions) and "complex" (TLV attributes like `minimapColor`, `tradeAs`). Both are decoded into a flat `flags` object.
- Versions before 7.55 do not have `patternZ`; before 9.6 do not have frame durations. `getVersionFeatures()` from `@paradoxlab/utils` exposes these flags if you need them.

---

[← Back to paradox-toolkit](../../README.md)
