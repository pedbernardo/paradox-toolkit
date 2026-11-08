import type { Hook, Patterns, SpriteCoordinates, SpriteLayout } from './types.js'

/** Tile size in pixels. */
export const TILE_PIXELS = 32

/** The client never raises items more than this many pixels on one tile (otclient `MAX_ELEVATION`). */
export const MAX_ELEVATION = 24

/** Legacy animation: every phase lasts 500 ms (items without enhanced animation data). */
export const LEGACY_PHASE_MS = 500

const FIRST_CELL: Patterns = { patternX: 0, patternY: 0, patternZ: 0 }

/** Index into a thing's sprite list, in DAT order (otclient `ThingType::getSpriteIndex`). */
export function spriteIndex(layout: SpriteLayout, at: SpriteCoordinates): number {
  // Axes from the slowest to the fastest: frame, pattern z, y, x, layer, part row, part column.
  const layers = layout.layers ?? 1
  const frame = at.frame % layout.frames
  const upToPatternZ = frame * layout.patternZ + at.patternZ
  const upToPatternY = upToPatternZ * layout.patternY + at.patternY
  const upToPatternX = upToPatternY * layout.patternX + at.patternX
  const upToLayer = upToPatternX * layers + (at.layer ?? 0)
  const upToRow = upToLayer * layout.height + at.h
  return upToRow * layout.width + at.w
}

/** Pixel offset of part (w, h) from the tile anchor: parts extend up and left of the anchor. */
export function partOffset(w: number, h: number): { readonly x: number; readonly y: number } {
  return { x: -w * TILE_PIXELS, y: -h * TILE_PIXELS }
}

/** Default pattern choice by map position (otclient `Item::calculatePatterns`, fallback branch). */
export function positionPatterns(layout: SpriteLayout, x: number, y: number, z: number): Patterns {
  return {
    patternX: x % Math.max(1, layout.patternX),
    patternY: y % Math.max(1, layout.patternY),
    patternZ: z % Math.max(1, layout.patternZ)
  }
}

/**
 * Stackable items with a 4x2 pattern grid pick the sprite by count:
 * 1-4 -> x = count - 1; then 5-9, 10-24, 25-49 and 50+ on the second row.
 * Other layouts use the first cell.
 */
export function stackablePatterns(layout: SpriteLayout, count: number): Patterns {
  const hasCountGrid = layout.patternX === 4 && layout.patternY === 2
  if (!hasCountGrid || count <= 0) return FIRST_CELL
  if (count < 5) return { patternX: count - 1, patternY: 0, patternZ: 0 }
  if (count < 10) return { patternX: 0, patternY: 1, patternZ: 0 }
  if (count < 25) return { patternX: 1, patternY: 1, patternZ: 0 }
  if (count < 50) return { patternX: 2, patternY: 1, patternZ: 0 }
  return { patternX: 3, patternY: 1, patternZ: 0 }
}

/** Splashes and fluid containers pick the sprite by fluid color: x = color % 4, y = color / 4. */
export function fluidPatterns(layout: SpriteLayout, color: number): Patterns {
  return {
    patternX: (color % 4) % Math.max(1, layout.patternX),
    patternY: Math.floor(color / 4) % Math.max(1, layout.patternY),
    patternZ: 0
  }
}

/** Hangable items face the wall they hang on: south hook -> x = 1, east hook -> x = 2, when the layout has them. */
export function hangablePatterns(layout: SpriteLayout, hook: Hook): Patterns {
  const hasSouthColumn = layout.patternX >= 2
  const hasEastColumn = layout.patternX >= 3
  if (hook === 'south' && hasSouthColumn) return { patternX: 1, patternY: 0, patternZ: 0 }
  if (hook === 'east' && hasEastColumn) return { patternX: 2, patternY: 0, patternZ: 0 }
  return FIRST_CELL
}

/** Elevation after stacking an item that raises the tile by `itemElevation` pixels. */
export function accumulateElevation(current: number, itemElevation: number): number {
  return Math.min(current + itemElevation, MAX_ELEVATION)
}

/** Legacy animation phase of a thing with `frames` phases at `timeMs`, derived from the clock only. */
export function legacyAnimationPhase(frames: number, timeMs: number): number {
  if (frames <= 1) return 0
  return Math.floor(timeMs / LEGACY_PHASE_MS) % frames
}
