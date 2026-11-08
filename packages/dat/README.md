# @paradoxlab/dat

[![npm](https://img.shields.io/npm/v/@paradoxlab/dat.svg)](https://www.npmjs.com/package/@paradoxlab/dat)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](../../LICENSE)

Parser and writer for the client's `.dat` file: the sprite layout and flags of every item, creature, effect and missile.

## Installation

```bash
npm install @paradoxlab/dat
```

## How to use

```ts
import { readFileSync, writeFileSync } from 'node:fs'
import { Dat } from '@paradoxlab/dat'

const dat = Dat() // version detected from the file signature; or Dat(772)
const file = dat.load(readFileSync('client.dat'))

// By group and client id
const grass = file.get('items', 102)
grass?.layout // { width, height, layers, patternX, patternY, patternZ, frames, ... }
grass?.flags.ground // { speed: 150 }
const creature = file.get('creatures', 35)

// Every thing, items first, then creatures, effects and missiles
for (const thing of file.entries()) console.log(thing.group, thing.cid, thing.spriteIds.length)

// Change and write back
file.get('items', 100)!.flags.stackable = true
writeFileSync('out.dat', Dat(772).write(file))

// Check the signature without parsing; throws ParseError on a mismatch
Dat(772).validate(readFileSync('client.dat'))
```

## API

### `Dat(version?, { strict? })`

Returns `{ load, write, validate }`. With a version, the file's signature must match it; without one, the version is detected from the signature. A version outside the supported list throws `UnsupportedVersionError`.

By default a thing that cannot be parsed is skipped with a warning; `{ strict: true }` throws instead.

| Method | Description |
|---|---|
| `load(buffer)` | Parses a `.dat` into a `DatFile`. Throws `ParseError` on malformed input |
| `write(file)` | Serializes a `DatFile` (or `{ version, signature, things }`) back to bytes |
| `validate(buffer)` | Checks the signature only; throws `ParseError` on a mismatch |

### `DatFile`

| Member | Description |
|---|---|
| `version`, `signature` | Client version and 32-bit signature |
| `counts` | `{ itemsMaxCid, creatures, effects, missiles }` |
| `things` | Every `Thing`, in client id order per group |
| `get(group, cid)` | One thing; `group` is `'items'`, `'creatures'`, `'effects'` or `'missiles'` |
| `entries()` | Iterates every `Thing` |

### `Thing`

| Field | Description |
|---|---|
| `cid`, `group` | Client id and group |
| `flags` | Only the flags the thing has: `true` for plain flags (`stackable`, `container`, `unpassable`, …), an object for flags with data (`ground: { speed }`, `lightInfo: { level, color }`, `hasOffset: { offsetX, offsetY }`, `hasElevation: { height }`, `minimap: { color }`, `market`, …) |
| `layout` | `{ width, height, layers, patternX, patternY, patternZ, frames, realSize, exactSize, animation? }`; `animation` holds frame timing (10.30+) |
| `spriteIds` | Sprite ids in DAT order (see `spriteIndex` in `@paradoxlab/appearance`) |
| `frameGroups` | Creature frame groups (idle, moving; 10.90+); `layout` and `spriteIds` mirror the last group |

## Format notes

- The signature at offset 0 identifies the client version.
- Flags are a list of one-byte ids, some followed by data, ending with 0xFF; the ids shift between versions, and `dat` maps them to the names above.
- Versions differ in pattern z (7.55+), extended sprite ids (9.60+), frame timing (10.30+) and frame groups (10.90+); `getVersionFeatures()` from `@paradoxlab/utils` lists them per version.

---

[← Back to paradox-toolkit](../../README.md)
