# @paradoxlab/backpack

[![npm](https://img.shields.io/npm/v/@paradoxlab/backpack.svg)](https://www.npmjs.com/package/@paradoxlab/backpack)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](../../LICENSE)

Builds the assets an OTServer client or map editor needs from the client files (`.dat`, `.spr`, `items.otb`):

- **Item content by sid:** one entry per item of the OTB, with its gameplay flags, and one appearance per client id, shared by every item that uses it.
- **Sprite atlases:** lossless PNG pages that fit a GPU texture (4096 px by default), with the position of every sprite; or one PNG per sprite.

## Installation

```bash
npm install @paradoxlab/backpack
```

## Command line

```bash
# Item content: content.json
npx backpack content --dat client.dat --otb items.otb --version 860 --out ./assets

# Sprite atlas: sprites-0.png, sprites-1.png, … and sprites.json
npx backpack sprites --spr client.spr --version 860 --out ./assets

# Only some sprites, trimmed to their opaque pixels, in smaller pages
npx backpack sprites --spr client.spr --version 860 --ids 1-500,1200 --trim --max-page-size 2048

# One PNG per sprite, e.g. for a website
npx backpack extract --spr client.spr --version 860 --ids 100-120 --out ./icons
```

Without `--otb`, `content` uses the client's items as the items, with sid = client id. Errors print a message and exit with code 1.

## API

### Item content

```ts
import { ItemFlag, buildContent, readDat, readOtb, viewContent } from '@paradoxlab/backpack'

const content = buildContent({
  dat: readDat('client.dat', 860),
  otb: readOtb('items.otb') // optional
})

const { items } = viewContent(content) // indexes the sids once

const coin = items.get(2148) // undefined for an unknown sid
coin?.has(ItemFlag.Stackable)
coin?.appearance?.sprite(0) // first sprite id; appearance is null if the client lacks the cid
```

`content` itself is plain JSON in columns (row i of every array is one item), ready for `JSON.stringify`. `viewContent` reads those columns on demand, without copying them; "none" values (-1 in the columns) read as `null`.

`content.meta.lineage` names the OTB version the sids belong to (`null` without an OTB). Every OTB entry becomes an item, so items that share a client id keep their own sid; a client thing without an OTB entry is only an appearance. Flags and sizes are in [SCHEMAS.md](../../docs/SCHEMAS.md).

### Sprite atlas

```ts
import { buildSpriteSheet, deflateNode, readSpr, viewFrames, writeOutput } from '@paradoxlab/backpack'

const sheet = await buildSpriteSheet(readSpr('client.spr', 860), {
  deflate: deflateNode,
  maxPageSize: 4096, // default
  padding: 1, // default
  trim: false // default; true packs each sprite's opaque rectangle only
  // ids: [1, 2, 3]  // default: every sprite
})

sheet.pages.forEach((png, index) => writeOutput(`assets/sprites-${index}.png`, png))
writeOutput('assets/sprites.json', JSON.stringify(sheet.json))

// Where sprite 1234 is: { id, page, x, y, w, h, offsetX, offsetY }, or undefined
const where = viewFrames(sheet.json.frames).get(1234)
```

Pages are drawn and encoded one at a time, so a client with hundreds of thousands of sprites never holds every page in memory. With `trim`, `offsetX` and `offsetY` say where the packed rectangle was inside the 32×32 sprite, and a fully transparent sprite has `w = h = 0` and page -1.

One PNG per sprite:

```ts
import { deflateNode, extractSprites, readSpr, writeOutput } from '@paradoxlab/backpack'

for await (const { id, png } of extractSprites(readSpr('client.spr', 860), [100, 101, 102], deflateNode)) {
  writeOutput(`icons/${id}.png`, png)
}
```

### In a browser

`@paradoxlab/backpack/content` and `@paradoxlab/backpack/sprites` do not import Node modules. Load the client files with `@paradoxlab/dat`, `@paradoxlab/otb` and `@paradoxlab/spr`, and give the sprite functions `deflateWeb`, built on `CompressionStream`:

```ts
import { buildSpriteSheet, deflateWeb } from '@paradoxlab/backpack/sprites'

const sheet = await buildSpriteSheet(spr, { deflate: deflateWeb })
```

## Quality and performance

Every page is an 8-bit RGBA PNG with no palette: decoding the pages gives back every sprite pixel for pixel, partial transparency included (checked on the 7.72 and 10.98 clients).
