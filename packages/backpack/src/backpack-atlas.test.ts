import { describe, expect, it } from 'vitest'
import { packAtlas } from './backpack-atlas.js'
import type { AtlasImage, AtlasLayout } from './types.js'

/** A square image: transparent, with an opaque block at (bx, by) of size bw x bh colored by id. */
function image(
  size: number,
  id: number,
  block?: { bx: number; by: number; bw: number; bh: number }
): AtlasImage {
  const rgba = new Uint8Array(size * size * 4)
  const { bx, by, bw, bh } = block ?? { bx: 0, by: 0, bw: size, bh: size }
  for (let y = by; y < by + bh; y++) {
    for (let x = bx; x < bx + bw; x++) rgba.set([id, x, y, 255], (y * size + x) * 4)
  }
  return { width: size, height: size, rgba }
}

function overlaps(layout: AtlasLayout): boolean {
  const { frames } = layout
  for (let a = 0; a < frames.id.length; a++) {
    for (let b = a + 1; b < frames.id.length; b++) {
      if (frames.page[a] !== frames.page[b] || frames.page[a] === -1) continue
      const apart =
        frames.x[a]! + frames.w[a]! <= frames.x[b]! ||
        frames.x[b]! + frames.w[b]! <= frames.x[a]! ||
        frames.y[a]! + frames.h[a]! <= frames.y[b]! ||
        frames.y[b]! + frames.h[b]! <= frames.y[a]!
      if (!apart) return true
    }
  }
  return false
}

describe('packAtlas', () => {
  const images = new Map(Array.from({ length: 30 }, (_, i) => [i + 1, image(8, i + 1)]))
  const imageOf = (id: number) => images.get(id)!
  const ids = [...images.keys()]

  it('places same-size images on a grid with the padding between them', () => {
    const layout = packAtlas(ids, imageOf, { maxPageSize: 64, padding: 1 })
    expect(overlaps(layout)).toBe(false)
    expect(layout.frames.x.slice(0, 3)).toEqual([0, 9, 18])
    expect(layout.frames.y[7]).toBe(9) // 7 images of 8 + 1 fit a 64px row
  })

  it('spills to more pages and cuts each page to its content', () => {
    const layout = packAtlas(ids.slice(0, 28), imageOf, { maxPageSize: 32, padding: 0 })
    expect(layout.pages).toHaveLength(2)
    expect(layout.pages[0]).toEqual({ width: 32, height: 32 })
    expect(layout.pages[1]).toEqual({ width: 32, height: 24 })
  })

  it('draws every image where its frame says, page by page', () => {
    const layout = packAtlas(ids, imageOf, { maxPageSize: 32, padding: 2 })
    const pages = layout.pages.map((_, index) => layout.renderPage(index))
    layout.frames.id.forEach((id, index) => {
      const page = pages[layout.frames.page[index]!]!
      const at = (layout.frames.y[index]! * page.width + layout.frames.x[index]!) * 4
      expect(page.rgba[at]).toBe(id)
      expect(page.rgba[at + 3]).toBe(255)
    })
  })

  it('trims to the opaque rectangle and records where it was', () => {
    const trimmed = new Map([
      [1, image(32, 1, { bx: 5, by: 10, bw: 4, bh: 3 })],
      [2, image(32, 2, { bx: 0, by: 0, bw: 0, bh: 0 })]
    ])
    const layout = packAtlas([1, 2], (id) => trimmed.get(id)!, { trim: true })
    const f = layout.frames
    expect([f.w[0], f.h[0], f.offsetX[0], f.offsetY[0]]).toEqual([4, 3, 5, 10])
    expect([f.w[1], f.h[1], f.page[1]]).toEqual([0, 0, -1])
    const page = layout.renderPage(0)
    expect(page.width * page.height).toBe(12)
    expect([...page.rgba.subarray(0, 4)]).toEqual([1, 5, 10, 255])
  })

  it('puts lower priorities first, each group on its own shelf', () => {
    const layout = packAtlas([1, 2, 3], imageOf, {
      maxPageSize: 64,
      priorityOf: (id) => (id === 3 ? 0 : 1)
    })
    expect(layout.frames.x[2]).toBe(0)
    expect(layout.frames.y[2]).toBe(0)
    expect(layout.frames.y[0]).toBe(9)
  })

  it('refuses an image larger than a page', () => {
    expect(() => packAtlas([1], () => image(70, 1), { maxPageSize: 64 })).toThrow(RangeError)
  })
})
