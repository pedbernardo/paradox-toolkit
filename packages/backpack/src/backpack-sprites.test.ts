import { deflateSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import type { Sprite, SprFile } from '@paradoxlab/spr'
import { readPng } from '../tests/support/png-reader.js'
import { buildSpriteSheet, extractSprites } from './backpack-sprites.js'

const deflate = (data: Uint8Array) => deflateSync(data)

/** A sprite file whose sprite n has a 2x2 opaque block of value n at (n, n); sprite 3 is empty. */
function sprOf(count: number): SprFile {
  const sprites = new Map<number, Sprite>()
  for (let id = 1; id <= count; id++) {
    const rgba = new Uint8Array(32 * 32 * 4)
    if (id !== 3) {
      for (const [x, y] of [
        [id, id],
        [id + 1, id],
        [id, id + 1],
        [id + 1, id + 1]
      ] as const) {
        rgba.set([id, 0, 0, 255], (y * 32 + x) * 4)
      }
    }
    sprites.set(id, { id, rgba, width: 32, height: 32 })
  }
  return {
    version: 772,
    signature: 0x439d5a33,
    count,
    get: (id) => sprites.get(id),
    entries: () => sprites.entries()
  }
}

describe('buildSpriteSheet', () => {
  it('packs every sprite into PNG pages and records where each one is', async () => {
    const spr = sprOf(10)
    const sheet = await buildSpriteSheet(spr, { deflate, maxPageSize: 64, padding: 0 })
    expect(sheet.json.meta).toEqual({
      schema: '2.0.0',
      client: 772,
      spr: '439D5A33',
      pages: [
        { width: 64, height: 64 },
        { width: 64, height: 64 },
        { width: 64, height: 32 }
      ],
      sprites: 10
    })
    expect(sheet.pages).toHaveLength(3)
    const { frames } = sheet.json
    const page = readPng(sheet.pages[frames.page[4]!]!)
    const x = frames.x[4]! + 5
    const y = frames.y[4]! + 5
    expect(page.rgba[(y * page.width + x) * 4]).toBe(5)
  })

  it('packs only the asked ids, trimmed', async () => {
    const sheet = await buildSpriteSheet(sprOf(10), { deflate, ids: [2, 3, 7], trim: true })
    const f = sheet.json.frames
    expect(f.id).toEqual([2, 3, 7])
    expect([f.w[0], f.h[0], f.offsetX[0], f.offsetY[0]]).toEqual([2, 2, 2, 2])
    expect(f.page[1]).toBe(-1)
    expect(sheet.json.meta.pages).toEqual([{ width: 5, height: 2 }])
  })

  it('refuses an id outside the file', async () => {
    await expect(buildSpriteSheet(sprOf(3), { deflate, ids: [4] })).rejects.toThrow(RangeError)
  })
})

describe('extractSprites', () => {
  it('yields one 32x32 PNG per id', async () => {
    const out = []
    for await (const sprite of extractSprites(sprOf(5), [1, 5], deflate)) out.push(sprite)
    expect(out.map((sprite) => sprite.id)).toEqual([1, 5])
    const decoded = readPng(out[1]!.png)
    expect([decoded.width, decoded.height]).toEqual([32, 32])
    expect(decoded.rgba[(5 * 32 + 5) * 4]).toBe(5)
  })
})
