# @paradoxlab/spr

[![npm](https://img.shields.io/npm/v/@paradoxlab/spr.svg)](https://www.npmjs.com/package/@paradoxlab/spr)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](../../LICENSE)

Parser and writer for `.spr` binary format. Reads 32×32 RGBA sprites with RLE decompression, transparent-magenta decoding, and lazy loading.

## Installation

```bash
npm install @paradoxlab/spr
```

## How to Use

```ts
import { readFileSync, writeFileSync } from 'node:fs'
import { Spr } from '@paradoxlab/spr'

// Parse
const file = Spr().load(readFileSync('772.spr'))

console.log(file.count) // total sprite count

// Access a sprite by ID (1-indexed)
const sprite = file.get(1)
// → { id: 1, rgba: Uint8ClampedArray(4096), width: 32, height: 32 }

// Iterate all sprites (lazy-decoded on access)
for (const sprite of file.entries()) {
  const { id, rgba } = sprite
  // rgba is RGBA: [ r, g, b, a, r, g, b, a, ... ] 4096 bytes (32×32×4)
  process(id, rgba)
}

// Write back to binary (round-trip)
const sprites = [...file.entries()]
writeFileSync('out.spr', Spr(772).write(sprites))

// Validate without loading
const result = Spr(772).validate(readFileSync('772.spr'))
// → { ok: true } | { ok: false, error: string }
```

## API

### `Spr(version?: number)`

Factory returning `{ load, write, validate }`. Omit version for auto-detection.

### `.load(buffer: ArrayBuffer | Uint8Array): SprFile`

Parse a `.spr` binary. Sprites are decoded lazily — pixel data is only decompressed on first access.

### `.write(sprites: SprWriteInput): Uint8Array`

Serialize sprites back to binary. Accepts the same `Sprite[]` shape returned by `.entries()`.

### `.validate(buffer: ArrayBuffer | Uint8Array): { ok: boolean; error?: string }`

Validate the signature and offset table without decoding any sprite.

### `SprFile`

| Property | Type | Description |
|---|---|---|
| `version` | `number` | Detected client version |
| `signature` | `number` | 32-bit file signature |
| `count` | `number` | Total number of sprites |
| `.get(id)` | `Sprite \| undefined` | Decode and return sprite by ID (1-indexed) |
| `.entries()` | `Iterable<Sprite>` | Iterate all sprites in ID order |

### `Sprite`

```ts
type Sprite = {
  id: number              // 1-indexed sprite ID
  rgba: Uint8ClampedArray // 32×32 RGBA pixels, row-major
  width: 32
  height: 32
}
```

Transparent sprites (ID maps to a null offset) return `rgba` filled with zeros.

## Format Notes

- Magenta (`#FF00FF`) pixels are the transparency color. The parser converts them to `alpha = 0`.
- Pixel data is RLE-compressed: each run is `(transparent_count: u16, colored_count: u16, colored_bytes...)`. The decoder expands this into flat RGBA.
- An offset table at the start of the file stores one `u32` per sprite pointing to its raw data position. Null offsets (0x00000000) indicate empty/transparent-only sprites.
- Extended sprite IDs (versions >= 960) use `u32` IDs; older versions use `u16`. The version flag `extendedSprites` in `@paradoxlab/utils` controls which is used.

---

[← Back to paradox-toolkit](../../README.md)
