# @paradoxlab/spriter

[![npm](https://img.shields.io/npm/v/@paradoxlab/spriter.svg)](https://www.npmjs.com/package/@paradoxlab/spriter)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](../../LICENSE)

Build tool that converts a parsed `.spr` file into a packed 4096×4096 spritesheet PNG plus a JSON positions map. Uses [sharp](https://sharp.pixelplumbing.com/) for image composition. Also ships a `spriter` CLI.

## Installation

```bash
npm install @paradoxlab/spriter
# sharp is a required dependency — native bindings are compiled on install
```

## How to Use

### Programmatic API

```ts
import { readFileSync, writeFileSync } from 'node:fs'
import { Spr } from '@paradoxlab/spr'
import { Spriter } from '@paradoxlab/spriter'

const sprFile = Spr().load(readFileSync('772.spr'))

const { png, positions, width, height } = await Spriter({ spr: sprFile }).build()

// png: Buffer — write directly to disk
writeFileSync('spritesheet.png', png)

// positions: Record<spriteId, { x, y }> — for GPU atlas lookups
writeFileSync('positions.json', JSON.stringify(positions, null, 2))

// Sheet dimensions are always 4096×4096
console.log(width, height) // 4096 4096
```

### CLI

```bash
# Generate spritesheet.png and positions.json
npx spriter generate \
  --spr 772.spr \
  --version 772 \
  --out ./output

# The command creates:
#   ./output/spritesheet.png
#   ./output/positions.json

npx spriter --help
```

## API

### `Spriter(input: SpiterInput)`

```ts
type SpriterInput = {
  spr: SprFile  // from @paradoxlab/spr
}
```

Returns `{ build }`.

### `.build(): Promise<SpritesheetOutput>`

Decode all sprites and compose them into a packed atlas.

```ts
type SpritesheetOutput = {
  png: Buffer                            // PNG-encoded spritesheet
  positions: Record<number, { x: number; y: number }> // sprite ID → top-left pixel
  width: 4096
  height: 4096
}
```

Sprites are laid out left-to-right, top-to-bottom, 32 pixels per cell. The 4096×4096 canvas fits 128×128 = 16,384 sprites — enough for any known Tibia version.

## Format Notes

- Sprite IDs in `positions` match the IDs from `SprFile.get()` — 1-indexed.
- Empty sprites (null offset in the `.spr` offset table) are still allocated a cell in the atlas; their pixels are all-transparent.
- sharp is used for maximum compositing performance and libvips-backed PNG encoding. If the native bindings fail to build, check the [sharp installation guide](https://sharp.pixelplumbing.com/install).
- The spritesheet is always exactly 4096×4096 regardless of how many sprites are in the file. Unused cells are transparent.

---

[← Back to paradox-toolkit](../../README.md)
