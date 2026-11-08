import { describe, expect, test } from 'vitest'
import {
  MAX_ELEVATION,
  accumulateElevation,
  fluidPatterns,
  hangablePatterns,
  legacyAnimationPhase,
  partOffset,
  positionPatterns,
  spriteIndex,
  stackablePatterns
} from './appearance.js'
import type { SpriteLayout } from './types.js'

const layout = (patch: Partial<SpriteLayout> = {}): SpriteLayout => ({
  width: 1,
  height: 1,
  patternX: 1,
  patternY: 1,
  patternZ: 1,
  frames: 1,
  ...patch
})

describe('spriteIndex', () => {
  test('walks w, h, layer, x, y, z, frame from the fastest to the slowest axis', () => {
    const l = layout({
      width: 2,
      height: 2,
      layers: 2,
      patternX: 4,
      patternY: 2,
      patternZ: 1,
      frames: 3
    })
    const base = { frame: 0, patternX: 0, patternY: 0, patternZ: 0, layer: 0, w: 0, h: 0 }
    expect(spriteIndex(l, base)).toBe(0)
    expect(spriteIndex(l, { ...base, w: 1 })).toBe(1)
    expect(spriteIndex(l, { ...base, h: 1 })).toBe(2)
    expect(spriteIndex(l, { ...base, layer: 1 })).toBe(4)
    expect(spriteIndex(l, { ...base, patternX: 1 })).toBe(8)
    expect(spriteIndex(l, { ...base, patternY: 1 })).toBe(32)
    expect(spriteIndex(l, { ...base, frame: 1 })).toBe(64)
    // The last sprite of the layout.
    expect(
      spriteIndex(l, { frame: 2, patternX: 3, patternY: 1, patternZ: 0, layer: 1, w: 1, h: 1 })
    ).toBe(191)
  })

  test('frames wrap and a missing layer count means one layer', () => {
    const l = layout({ patternX: 2, frames: 2 })
    expect(spriteIndex(l, { frame: 3, patternX: 1, patternY: 0, patternZ: 0, w: 0, h: 0 })).toBe(3)
  })
})

describe('partOffset', () => {
  test('parts extend up and left of the bottom-right anchor', () => {
    expect(partOffset(0, 0)).toEqual({ x: -0, y: -0 })
    expect(partOffset(1, 0)).toEqual({ x: -32, y: -0 })
    expect(partOffset(1, 1)).toEqual({ x: -32, y: -32 })
  })
})

describe('patterns', () => {
  test('position patterns wrap the map position over the pattern grid', () => {
    expect(positionPatterns(layout({ patternX: 4, patternY: 3, patternZ: 2 }), 13, 7, 7)).toEqual({
      patternX: 1,
      patternY: 1,
      patternZ: 1
    })
    expect(positionPatterns(layout({ patternX: 0, patternY: 0, patternZ: 0 }), 5, 5, 5)).toEqual({
      patternX: 0,
      patternY: 0,
      patternZ: 0
    })
  })

  test.each([
    [0, 0, 0],
    [1, 0, 0],
    [4, 3, 0],
    [5, 0, 1],
    [9, 0, 1],
    [10, 1, 1],
    [24, 1, 1],
    [25, 2, 1],
    [49, 2, 1],
    [50, 3, 1],
    [100, 3, 1]
  ])('stackable count %i -> pattern (%i, %i)', (count, x, y) => {
    expect(stackablePatterns(layout({ patternX: 4, patternY: 2 }), count)).toEqual({
      patternX: x,
      patternY: y,
      patternZ: 0
    })
  })

  test('stackables without a 4x2 grid use the first cell', () => {
    expect(stackablePatterns(layout({ patternX: 1, patternY: 1 }), 30)).toEqual({
      patternX: 0,
      patternY: 0,
      patternZ: 0
    })
  })

  test('fluids map the color onto a 4-wide grid', () => {
    const l = layout({ patternX: 4, patternY: 4 })
    expect(fluidPatterns(l, 0)).toEqual({ patternX: 0, patternY: 0, patternZ: 0 })
    expect(fluidPatterns(l, 6)).toEqual({ patternX: 2, patternY: 1, patternZ: 0 })
    expect(fluidPatterns(layout({ patternX: 0, patternY: 0 }), 6)).toEqual({
      patternX: 0,
      patternY: 0,
      patternZ: 0
    })
  })

  test('hangables face the hook when the layout has that column', () => {
    const three = layout({ patternX: 3 })
    expect(hangablePatterns(three, 'south').patternX).toBe(1)
    expect(hangablePatterns(three, 'east').patternX).toBe(2)
    expect(hangablePatterns(three, null).patternX).toBe(0)
    expect(hangablePatterns(layout({ patternX: 2 }), 'east').patternX).toBe(0)
    expect(hangablePatterns(layout({ patternX: 1 }), 'south').patternX).toBe(0)
  })
})

describe('elevation and animation', () => {
  test('elevation accumulates up to the client cap', () => {
    expect(accumulateElevation(0, 8)).toBe(8)
    expect(accumulateElevation(16, 16)).toBe(MAX_ELEVATION)
  })

  test('legacy animation advances one phase every 500 ms', () => {
    expect(legacyAnimationPhase(1, 10_000)).toBe(0)
    expect(legacyAnimationPhase(4, 0)).toBe(0)
    expect(legacyAnimationPhase(4, 499)).toBe(0)
    expect(legacyAnimationPhase(4, 500)).toBe(1)
    expect(legacyAnimationPhase(4, 2_000)).toBe(0)
  })
})
