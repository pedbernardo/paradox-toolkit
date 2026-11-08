# @paradoxlab/spr

[![npm](https://img.shields.io/npm/v/@paradoxlab/spr.svg)](https://www.npmjs.com/package/@paradoxlab/spr)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](../../LICENSE)

Parser and writer for the client's `.spr` file: every 32×32 sprite, decoded to RGBA on first access.

## Installation

```bash
npm install @paradoxlab/spr
```

## How to use

```ts
import { readFileSync, writeFileSync } from 'node:fs'
import { Spr } from '@paradoxlab/spr'

const file = Spr().load(readFileSync('client.spr')) // version from the signature; or Spr(772)
file.count // number of sprites

const sprite = file.get(1) // ids start at 1
// → { id: 1, rgba: Uint8Array(4096), width: 32, height: 32 }

for (const [id, { rgba }] of file.entries()) {
  // rgba: r, g, b, a for each of the 32×32 pixels, row by row
}

writeFileSync('out.spr', Spr(772).write(file))

// Check the signature without parsing; throws ParseError on a mismatch
Spr(772).validate(readFileSync('client.spr'))
```

## API

### `Spr(version?)`

Returns `{ load, write, writeStream, validate }`. With a version, the file's signature must match it; without one, the version is detected from the signature.

| Method | Description |
|---|---|
| `load(buffer)` | Reads the offset table; each sprite is decoded on first `get` and then kept |
| `write(input, { onProgress? })` | Serializes an `SprFile`, or any iterable of `Sprite \| null` (null for an empty sprite) |
| `writeStream(input, { onProgress? })` | The same, as an async generator of chunks |
| `validate(buffer)` | Checks the signature only; throws `ParseError` on a mismatch |

### `SprFile`

| Member | Description |
|---|---|
| `version`, `signature`, `count` | Client version, 32-bit signature and number of sprites |
| `get(id)` | The sprite, or `undefined` outside `1..count` |
| `entries()` | `[id, sprite]` for every sprite, in id order |

An empty sprite (offset 0 in the file) decodes to 4,096 zero bytes. Decoded sprites stay cached in the `SprFile`: reading every sprite of a large client holds all of them (about 1.4 GB for 339 thousand sprites).

`renderAscii(sprite)` draws a sprite as text, for tests and debugging; `serializeSpr(input, version)` is the writer behind `write`, returning the chunks.

## Format notes

- After the signature comes the sprite count (u16, or u32 from 9.60 on) and one u32 offset per sprite.
- Each sprite stores runs of `(transparent pixels: u16, colored pixels: u16, colored pixels × RGB)`; a transparent pixel decodes to alpha 0, a colored one to alpha 255.

---

[← Back to paradox-toolkit](../../README.md)
