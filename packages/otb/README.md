# @paradoxlab/otb

[![npm](https://img.shields.io/npm/v/@paradoxlab/otb.svg)](https://www.npmjs.com/package/@paradoxlab/otb)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](../../LICENSE)

Parser and writer for OTServer's `items.otb`: every item's server id (sid), client id (cid), flags and attributes.

## Installation

```bash
npm install @paradoxlab/otb
```

## How to use

```ts
import { readFileSync, writeFileSync } from 'node:fs'
import { Otb, inlineCountOf } from '@paradoxlab/otb'

const file = Otb().load(readFileSync('items.otb'))
file.schemaVersion // '3.57.62': major (the OTB lineage), minor and build
file.count

const coin = file.get(2148) // by sid
coin?.cid
coin?.flags.stackable // true
coin?.attributes.name // 'gold coin'

for (const [sid, item] of file.entries()) {
  if (item.flags.hangable) console.log(sid, item.attributes.name)
}

file.items[0]!.flags.stackable = true
writeFileSync('out.otb', Otb().write(file))

// What reading an OTBM v1 map needs: which sids store an untagged count byte
const hasInlineCount = inlineCountOf(file)
```

## API

### `Otb()`

Returns `{ load, write, validate }`. There is no version parameter: the OTB version is read from the file.

| Method | Description |
|---|---|
| `load(buffer)` | Parses `items.otb` into an `OtbFile`. Throws `ParseError` on malformed input |
| `write(file)` | Serializes an `OtbFile` (or `{ schemaVersion, items }`) back to bytes, escaping reserved bytes |
| `validate(buffer)` | Checks the header only; throws `ParseError` on a mismatch |

`inlineCountOf(file)` returns a `(sid) => boolean` predicate, backed by one bit per sid, for `Otbm({ hasInlineCount })`.

### `OtbFile`

| Member | Description |
|---|---|
| `schemaVersion` | `'major.minor.build'`, e.g. `'3.57.62'`; the major and minor are the version a map's header names |
| `count`, `items` | Every `OtbItem`, in file order |
| `get(sid)` | One item by sid |
| `entries()` | `[sid, item]` pairs |

### `OtbItem`

| Field | Description |
|---|---|
| `sid`, `cid` | Server id and client id; many sids can share one cid |
| `group` | Item group number from the file |
| `flags` | Every flag as a boolean: `unpassable`, `blockMissiles`, `blockPathfinder`, `hasElevation`, `useable`, `pickupable`, `moveable`, `stackable`, the five `floorChange*`, `alwaysOnTop`, `readable`, `rotable`, `hangable`, `hookEast`, `hookSouth`, `cannotDecay`, `allowDistRead`, `clientDuration`, `clientCharges`, `ignoreLook`, `isAnimation`, `fullGround`, `forceUse` |
| `attributes` | The attributes the item has: `name`, `description`, `speed`, `weight`, `spriteHash`, `minimapColor`, `maxItems`, `rotateTo`, `maxWriteLength`, `maxReadLength`, `lightLevel`, `lightColor`, `alwaysOnTopOrder`, `wareId`, `classification` |

## Format notes

- A tree of nodes: a root node holding one node per item; 0xFE starts a node and 0xFF ends it, and data bytes from 0xFD up are escaped with 0xFD.
- Attributes are `(id: u8, length: u16, value)`. Attribute ids the parser does not know are skipped, so they are not written back.
- Names and descriptions are read and written as windows-1252, byte for byte.

---

[← Back to paradox-toolkit](../../README.md)
