# @paradoxlab/otb

[![npm](https://img.shields.io/npm/v/@paradoxlab/otb.svg)](https://www.npmjs.com/package/@paradoxlab/otb)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](../../LICENSE)

Parser and writer for OTServer's `items.otb` binary format. Reads item metadata (server IDs, client IDs, flags, and TLV attributes) used by TFS and compatible OTServer implementations.

## Installation

```bash
npm install @paradoxlab/otb
```

## How to Use

```ts
import { readFileSync, writeFileSync } from 'node:fs'
import { Otb } from '@paradoxlab/otb'

// Parse
const file = Otb().load(readFileSync('items.otb'))

console.log(file.count) // total item count

// Access by server ID
const grass = file.get(100)
// → { sid: 100, cid: 1, group: 'ground', flags: OtbFlags, attributes: OtbAttributes }

// Inspect attributes
console.log(grass?.attributes.name)    // 'Grass'
console.log(grass?.attributes.weight) // 0

// Iterate all items
for (const item of file.entries()) {
  if (item.flags.stackable) {
    console.log(item.sid, item.attributes.name)
  }
}

// Mutate and write back
const otb = Otb()
const newFile = otb.load(readFileSync('items.otb'))
newFile.items[0]!.flags.stackable = true
writeFileSync('out.otb', Otb().write(newFile))

// Validate without fully loading
const result = Otb().validate(readFileSync('items.otb'))
// → { ok: true } | { ok: false, error: string }
```

## API

### `Otb()`

Factory returning `{ load, write, validate }`. Unlike DAT/SPR, OTB has no version parameter — the schema version is read from the file header.

### `.load(buffer: ArrayBuffer | Uint8Array): OtbFile`

Parse an `items.otb` binary. Throws `ParseError` on malformed input.

### `.write(data: OtbWriteInput): Uint8Array`

Serialize an `OtbFile` (or compatible object) back to binary. Escape sequences are applied automatically.

### `.validate(buffer: ArrayBuffer | Uint8Array): { ok: boolean; error?: string }`

Check the root node marker and schema version without parsing items.

### `OtbFile`

| Property | Type | Description |
|---|---|---|
| `schemaVersion` | `number` | OTB schema version (typically 3) |
| `count` | `number` | Total number of items |
| `items` | `OtbItem[]` | All parsed items |
| `.get(sid)` | `OtbItem \| undefined` | Look up item by server ID |
| `.entries()` | `Iterable<OtbItem>` | Iterate all items |

### `OtbItem`

| Property | Type | Description |
|---|---|---|
| `sid` | `number` | Server item ID |
| `cid` | `number` | Client item ID (DAT lookup key) |
| `group` | `OtbGroup` | `'none' \| 'ground' \| 'container' \| 'weapon' \| ...` |
| `flags` | `OtbFlags` | Boolean properties: `stackable`, `usable`, `moveable`, `pickupable`, `rotatable`, ... |
| `attributes` | `OtbAttributes` | TLV attributes: `name`, `weight`, `attack`, `defense`, `armor`, `decayTo`, ... |

## Format Notes

- The binary format uses a tree structure: a root node wraps item nodes, each terminated by a `0xFF` end-of-node byte.
- Reserved bytes (`0xFD`, `0xFE`, `0xFF`) within item data are escaped with a `0xFD` prefix (similar to OTBM). The writer handles this automatically.
- Attributes are encoded as TLV (type, length, value) sequences. Unknown attribute types are preserved verbatim during round-trips.
- The schema version in the root node header determines which flags and attribute IDs are valid. Schema version 3 is standard for TFS 1.x.

---

[← Back to paradox-toolkit](../../README.md)
