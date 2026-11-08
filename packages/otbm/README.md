# @paradoxlab/otbm

[![npm](https://img.shields.io/npm/v/@paradoxlab/otbm.svg)](https://www.npmjs.com/package/@paradoxlab/otbm)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](../../LICENSE)

Lossless reader and writer for the OTServer `.otbm` map format, OTBM v1 to v4. Reading a map and writing it back gives the same bytes, malformed maps included; the 104 MB map used as a stress test is read in about 0.7 s and copied in about 1.4 s in Node.

## Installation

```bash
npm install @paradoxlab/otbm
```

## How it works

The reader reports a map as **OTBM events** in file order (header, areas, tiles, items, towns…), carrying everything needed to write it back: inline vs node items, attribute order, unknown attributes and nodes, trailing bytes. The writer consumes the same events. Everything else is built on that pair:

| You want to | Use | Memory |
|---|---|---|
| Inspect or index a map of any size | `otbm.read(bytes, visitor)` | nothing per tile |
| Copy or convert a map | `otbm.writeStream(upgradeOtbm(otbm.source(bytes), 3))` | about one 1 MB chunk |
| Edit a small or medium map as objects | `otbm.load(bytes)`, edit, `otbm.write(document)` | an object per tile and item |
| Save your own editable model in the original layout | `collectSourceLayout` + `composeOtbm` | the layout: 2 bytes per tile |

The examples below are in [`examples/`](../../examples/src) and run in CI.

## Read with a visitor

```ts
import { Otbm } from '@paradoxlab/otbm'

const stats = { tiles: 0, houseTiles: 0, items: 0, towns: [] as string[] }
Otbm().read(bytes, {
  tile: (_x, _y, _z, _flags, houseId) => {
    stats.tiles++
    if (houseId !== null) stats.houseTiles++
  },
  item: () => {
    stats.items++
  },
  town: (town) => {
    stats.towns.push(town.name)
  }
})
```

Every visitor method is optional. `tile` and `item` take positional arguments so reading allocates nothing for a tile or an item without attributes.

**OTBM v1** stores counts as an untagged byte that only the item database can identify; pass the predicate from `@paradoxlab/otb`:

```ts
import { Otb, inlineCountOf } from '@paradoxlab/otb'

const otbm = Otbm({ hasInlineCount: inlineCountOf(Otb().load(itemsOtbBytes)) })
```

## Convert in streaming

```ts
import { Otbm, upgradeOtbm } from '@paradoxlab/otbm'

const otbm = Otbm(options)
for (const chunk of otbm.writeStream(upgradeOtbm(otbm.source(bytes), 3))) {
  await file.write(chunk)
}
```

`writeStream` pulls the source one tile area at a time and hands out chunks of about `chunkBytes` (1 MB by default), so the writer never holds the whole file. Only upgrades exist (v1 → v2 → v3): a downgrade would lose data.

## Edit as objects

```ts
const otbm = Otbm()
const document = otbm.load(bytes)
const tile = document.getTile(256, 257, 7)
// edit tile.items, document.entries, document.header…
const out = otbm.write(document) // unchanged parts keep their bytes
```

`load` keeps an object per tile and item: a 12 MB map takes about 450 MB of heap, a 79 MB one about 3 GB. For large maps, use `read` and your own model.

## Save your own model in the original layout

```ts
import { Otbm, collectSourceLayout, composeOtbm } from '@paradoxlab/otbm'

const layout = collectSourceLayout()
otbm.read(bytes, [layout.visitor, loadIntoMyModel]) // one pass, several visitors
// … edit the model …
const out = otbm.write(composeOtbm(layout.layout(), myModelAsTileSource))
```

The composer writes areas and tiles in their original order (an unedited map comes back byte for byte), skips deleted tiles, and puts new tiles in canonical 256×256 areas after the original ones. Your model implements `OtbmTileSource`: `hasTile`, `emitTile` and `forEachTile`. See [`examples/src/otbm-compose.ts`](../../examples/src/otbm-compose.ts).

## Strings

Strings are read with a text codec, windows-1252 by default; maps written in Polish, Russian or UTF-8 need `windows1250`, `windows1251` or `utf8` from `@paradoxlab/utils`. Every built-in codec gives back the original bytes of an unedited string, and writing a character the codec cannot represent throws `UnencodableTextError`. `detectTextCodec` suggests a codec from a map's strings ([example](../../examples/src/otbm-detect-codec.ts)).

## Diagnostics and ceilings

Structure the reader does not expect is kept, never repaired: an unknown node, a tile outside an area or bytes after the root are written back as they were. Tile flags after a tile's inline items are the one exception: they are written back first, the canonical order, and a repeated flags attribute keeps only the last value. Each kind is reported once, after reading, through the visitor's `diagnostic` event (`{ code, offset, count, message }`).

Ceilings stop corrupt or hostile files with a `ParseError`: file size (3× the largest known map), items per tile, items per container, nesting and property bytes per node. They are in `DEFAULT_OTBM_LIMITS` and can be changed with `Otbm({ limits })`.

## Compare

`compareOtbm(a, b)` lists what two loaded maps mean differently, ignoring how they are stored: inline vs node items, attribute order, area layout. Useful in tests of tools that edit maps.

## Performance

Numbers, method and the history of the reader are in [`results/perf.md`](results/perf.md). Run them with `pnpm --filter @paradoxlab/otbm bench` (needs the local fixtures).
