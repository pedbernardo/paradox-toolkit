# @paradoxlab/thinger

[![npm](https://img.shields.io/npm/v/@paradoxlab/thinger.svg)](https://www.npmjs.com/package/@paradoxlab/thinger)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](../../LICENSE)

Build tool that merges a parsed `.dat` file with a parsed `items.otb` file to produce typed `ContentDefinitions` JSON — the content layer consumed by game servers and web tooling. Also ships a `thinger` CLI.

## Installation

```bash
npm install @paradoxlab/thinger
# includes @paradoxlab/dat and @paradoxlab/otb as peer dependencies
```

## How to Use

### Programmatic API

```ts
import { readFileSync, writeFileSync } from 'node:fs'
import { Dat } from '@paradoxlab/dat'
import { Otb } from '@paradoxlab/otb'
import { Thinger } from '@paradoxlab/thinger'

const datFile = Dat().load(readFileSync('772.dat'))
const otbFile = Otb().load(readFileSync('items.otb'))

const { meta, items, creatures, effects, missiles } = Thinger({ dat: datFile, otb: otbFile }).build()

console.log(meta.version)       // 772
console.log(items.length)       // e.g. 2004
console.log(items[0]!.name)     // 'Grass'
console.log(items[0]!.stackable) // true | false
console.log(creatures[0]!.cid)  // client ID (DAT lookup key)

// Persist as JSON
writeFileSync('content.json', JSON.stringify({ meta, items, creatures, effects, missiles }, null, 2))
```

### CLI

```bash
# Generate content.json from binary files
npx thinger generate \
  --dat 772.dat \
  --otb items.otb \
  --version 772 \
  --out content.json

# Options
npx thinger --help
```

## API

### `Thinger(input: ThingerInput)`

```ts
type ThingerInput = {
  dat: DatFile  // from @paradoxlab/dat
  otb: OtbFile  // from @paradoxlab/otb
}
```

Returns `{ build }`.

### `.build(): ContentDefinitions`

Merges DAT visual properties with OTB server metadata.

```ts
type ContentDefinitions = {
  meta: ContentMeta        // { version, generatedAt }
  items: ContentItem[]     // merged DAT + OTB fields
  creatures: ContentCreature[]  // DAT only (no OTB counterpart)
  effects: ContentEffect[]      // DAT only
  missiles: ContentMissile[]    // DAT only
}
```

### `ContentItem`

Items are the intersection of DAT visual definitions and OTB server metadata. Key fields:

| Field | Source | Description |
|---|---|---|
| `cid` | DAT | Client ID |
| `sid` | OTB | Server ID |
| `name` | OTB | Item name |
| `weight` | OTB | Weight in oz |
| `stackable` | DAT + OTB | True if stackable |
| `container` | DAT | True if container |
| `width` / `height` | DAT | Sprite grid size |
| `lightLevel` / `lightColor` | DAT | Light source |
| `flags` | merged | Full merged flag set |

Items without an OTB counterpart (DAT-only) have `sid: undefined`.

## Format Notes

- The merge key is the client ID (`cid`): DAT is iterated by client ID; OTB entries map their client ID to a server ID. Items present in OTB but missing from DAT emit a warning and are skipped.
- Creature, effect, and missile entries come from DAT only — there is no OTB equivalent for these groups.
- `generatedAt` in `meta` is an ISO 8601 timestamp set at build time.

---

[← Back to paradox-toolkit](../../README.md)
