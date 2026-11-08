import { describe, expect, it } from 'vitest'
import { spriteIndex } from '@paradoxlab/appearance'
import type { Sprite, SprFile } from '@paradoxlab/spr'
import { composeAppearances, composeLayers } from './backpack-compose.js'
import { StackOrder } from './backpack-flags.js'
import type { AppearanceColumns } from './types.js'

const PIXELS = 32 * 32

/** Sprite 1: opaque red; 2: a blue dot at (5, 5); 3: half-transparent green; 4: transparent. */
function spr(): SprFile {
  const sprites = new Map<number, Sprite>()
  const add = (id: number, paint: (rgba: Uint8Array) => void) => {
    const rgba = new Uint8Array(PIXELS * 4)
    paint(rgba)
    sprites.set(id, { id, rgba, width: 32, height: 32 })
  }
  add(1, (rgba) => {
    for (let p = 0; p < PIXELS; p++) rgba.set([255, 0, 0, 255], p * 4)
  })
  add(2, (rgba) => rgba.set([0, 0, 255, 255], (5 * 32 + 5) * 4))
  add(3, (rgba) => {
    for (let p = 0; p < PIXELS; p++) rgba.set([0, 255, 0, 128], p * 4)
  })
  add(4, () => {})
  return {
    version: 772,
    signature: 1,
    count: 4,
    get: (id) => sprites.get(id),
    entries: () => sprites.entries()
  }
}

type Row = {
  layout?: Partial<{
    width: number
    height: number
    layers: number
    patternX: number
    frames: number
  }>
  sprites: number[]
  order?: number
}

function columns(rows: Row[]): AppearanceColumns {
  const c: Record<keyof AppearanceColumns, number[]> = {
    cid: [],
    width: [],
    height: [],
    layers: [],
    patternX: [],
    patternY: [],
    patternZ: [],
    frames: [],
    spriteStart: [],
    spriteIds: [],
    order: [],
    elevation: [],
    offsetX: [],
    offsetY: [],
    lightLevel: [],
    lightColor: [],
    flags: []
  }
  rows.forEach((row, index) => {
    const layout = { width: 1, height: 1, layers: 1, patternX: 1, frames: 1, ...row.layout }
    c.cid.push(100 + index)
    c.width.push(layout.width)
    c.height.push(layout.height)
    c.layers.push(layout.layers)
    c.patternX.push(layout.patternX)
    c.patternY.push(1)
    c.patternZ.push(1)
    c.frames.push(layout.frames)
    c.spriteStart.push(c.spriteIds.length)
    c.spriteIds.push(...row.sprites)
    c.order.push(row.order ?? StackOrder.Common)
    c.elevation.push(0)
    c.offsetX.push(0)
    c.offsetY.push(0)
    c.lightLevel.push(0)
    c.lightColor.push(0)
    c.flags.push(0)
  })
  return c
}

const pixel = (rgba: Uint8Array, x: number, y: number) => [
  ...rgba.subarray((y * 32 + x) * 4, (y * 32 + x) * 4 + 4)
]

describe('composeLayers', () => {
  it('draws the top layer over the bottom one and blends partial alpha', () => {
    const s = spr()
    const out = composeLayers([s.get(1)!.rgba, s.get(2)!.rgba])
    expect(pixel(out, 5, 5)).toEqual([0, 0, 255, 255])
    expect(pixel(out, 0, 0)).toEqual([255, 0, 0, 255])
    const blended = composeLayers([s.get(1)!.rgba, s.get(3)!.rgba])
    expect(pixel(blended, 0, 0)).toEqual([127, 128, 0, 255])
    expect(pixel(composeLayers([undefined, s.get(3)!.rgba]), 0, 0)).toEqual([0, 255, 0, 128])
  })
})

describe('composeAppearances', () => {
  it('flattens two layers into one frame with the top layer over the bottom', () => {
    const composed = composeAppearances(
      columns([{ layout: { layers: 2 }, sprites: [1, 2] }]),
      [0],
      spr()
    )
    expect(composed.frameCount).toBe(1)
    expect(composed.appearances.frameIds).toEqual([1])
    expect(pixel(composed.imageOf(1).rgba, 5, 5)).toEqual([0, 0, 255, 255])
    expect(pixel(composed.imageOf(1).rgba, 0, 0)).toEqual([255, 0, 0, 255])
  })

  it('shares frames with the same layer sprites, across appearances too', () => {
    const composed = composeAppearances(
      columns([{ layout: { patternX: 2 }, sprites: [2, 2] }, { sprites: [2] }]),
      [0, 1],
      spr()
    )
    expect(composed.frameCount).toBe(1)
    expect(composed.appearances.frameIds).toEqual([1, 1, 1])
    expect(composed.appearances.frameStart).toEqual([0, 2])
  })

  it('maps transparent or missing sprites to frame 0', () => {
    const composed = composeAppearances(
      columns([{ layout: { patternX: 3 }, sprites: [0, 4, 99] }]),
      [0],
      spr()
    )
    expect(composed.frameCount).toBe(0)
    expect(composed.appearances.frameIds).toEqual([0, 0, 0])
  })

  it('is opaque only when every frame has no transparent pixel', () => {
    const composed = composeAppearances(
      columns([{ sprites: [1] }, { layout: { frames: 2 }, sprites: [1, 2] }, { sprites: [3] }]),
      [0, 1, 2],
      spr()
    )
    expect(composed.appearances.opaque).toEqual([1, 0, 0])
  })

  it('orders frames like spriteIndex on a single-layer layout', () => {
    const layout = { width: 2, height: 2, layers: 2, patternX: 1, frames: 1 }
    const sprites = [1, 1, 1, 1, 2, 3, 4, 0] // layer 0 then layer 1, parts in DAT order
    const composed = composeAppearances(columns([{ layout, sprites }]), [0], spr())
    const at = (w: number, h: number) =>
      composed.appearances.frameIds[
        spriteIndex(
          { ...layout, layers: 1, patternY: 1, patternZ: 1 },
          { frame: 0, patternX: 0, patternY: 0, patternZ: 0, w, h }
        )
      ]!
    expect(pixel(composed.imageOf(at(0, 0)).rgba, 5, 5)).toEqual([0, 0, 255, 255])
    expect(pixel(composed.imageOf(at(1, 1)).rgba, 0, 0)).toEqual([255, 0, 0, 255])
    expect(at(1, 0)).not.toBe(at(0, 1))
  })

  it('packs grounds and borders first, even when other items share the frame', () => {
    const composed = composeAppearances(
      columns([{ sprites: [1] }, { sprites: [1], order: StackOrder.Ground }, { sprites: [2] }]),
      [0, 1, 2],
      spr()
    )
    expect([composed.priorityOf(1), composed.priorityOf(2)]).toEqual([0, 1])
  })

  it('composes only the asked rows, in the asked order', () => {
    const composed = composeAppearances(columns([{ sprites: [1] }, { sprites: [2] }]), [1], spr())
    expect(composed.appearances.cid).toEqual([101])
  })
})
