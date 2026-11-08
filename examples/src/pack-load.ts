import { spriteIndex, stackablePatterns } from '@paradoxlab/appearance'
import { ItemFlag } from '@paradoxlab/backpack'
import type { AssetPack } from '@paradoxlab/backpack/load'

export type DrawCall = {
  /** Atlas page and the rectangle to copy from it. */
  page: number
  source: { x: number; y: number; w: number; h: number }
  /** Where the rectangle goes, relative to the tile's top-left corner. */
  at: { x: number; y: number }
}

/** What a renderer draws for a stack of `count` items with this sid on one tile. */
export function drawStack(pack: AssetPack, sid: number, count: number): DrawCall | undefined {
  const item = pack.items?.get(sid)
  const look = item?.appearance
  if (item === undefined || look === null || look === undefined || pack.frames === null)
    return undefined

  const layout = look.layout
  const patterns = item.has(ItemFlag.Stackable)
    ? stackablePatterns(layout, count)
    : { patternX: 0, patternY: 0, patternZ: 0 }
  const frame = look.frame(spriteIndex(layout, { frame: 0, ...patterns, w: 0, h: 0 }))!
  const f = pack.frames
  if (frame === 0) return undefined // nothing to draw
  return {
    page: f.page[frame]!,
    source: { x: f.x[frame]!, y: f.y[frame]!, w: f.w[frame]!, h: f.h[frame]! },
    // Trimmed frames keep their place inside the 32x32 cell; the offset moves the whole item.
    at: { x: f.offsetX[frame]! - look.offset.x, y: f.offsetY[frame]! - look.offset.y }
  }
}
