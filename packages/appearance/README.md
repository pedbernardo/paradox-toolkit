# @paradoxlab/appearance

[![npm](https://img.shields.io/npm/v/@paradoxlab/appearance.svg)](https://www.npmjs.com/package/@paradoxlab/appearance)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](../../LICENSE)

The visual rules of OTServer thing types: which sprite of a DAT entry to draw for a frame, a pattern and a part of a multi-tile thing, which pattern an item uses at a position or with a count, a fluid or a hook, how items raise the next ones on a tile, and the legacy animation clock. Pure functions, no dependencies; they mirror the client (otclient) and work for any renderer, with or without the other toolkit packages.

## Installation

```bash
npm install @paradoxlab/appearance
```

## Picking a sprite

```ts
import { spriteIndex, stackablePatterns } from '@paradoxlab/appearance'

// A stack of 7 gold coins: the count chooses the pattern, the pattern chooses the sprite.
const layout = { width: 1, height: 1, layers: 1, patternX: 4, patternY: 2, patternZ: 1, frames: 1 }
const patterns = stackablePatterns(layout, 7) // { patternX: 0, patternY: 1, patternZ: 0 }
const index = spriteIndex(layout, { frame: 0, ...patterns, w: 0, h: 0 })
const spriteId = thing.spriteIds[index]
```

## Rules

| Function | What it decides | Client counterpart |
|---|---|---|
| `spriteIndex(layout, at)` | Index into a thing's sprite list for a frame, pattern, layer and part | `ThingType::getSpriteIndex` |
| `partOffset(w, h)` | Pixel offset of a part of a multi-tile thing; parts extend up and left of the bottom-right anchor | |
| `positionPatterns(layout, x, y, z)` | Default pattern by map position (grounds, walls) | `Item::calculatePatterns`, fallback |
| `stackablePatterns(layout, count)` | Pattern by count on a 4×2 grid: 1-4, 5-9, 10-24, 25-49, 50+ | `Item::calculatePatterns`, stackables |
| `fluidPatterns(layout, color)` | Pattern by fluid color for splashes and fluid containers | `Item::calculatePatterns`, fluids |
| `hangablePatterns(layout, hook)` | Pattern facing the wall a hangable item hangs on | `Item::calculatePatterns`, hangables |
| `accumulateElevation(current, item)` | Elevation after stacking an item, capped at `MAX_ELEVATION` (24 px) | `Tile` drawing |
| `legacyAnimationPhase(frames, timeMs)` | Animation phase from the clock, one phase every `LEGACY_PHASE_MS` (500 ms) | legacy animation |

`SpriteLayout.layers` defaults to 1, which is also the layout of a pre-composed frame (an atlas where an item's layers were already stacked).
