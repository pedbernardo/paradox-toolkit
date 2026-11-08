import { deflateSync } from 'node:zlib'
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { readPng } from '../tests/support/png-reader.js'
import { deflateWeb, encodePng } from './backpack-png.js'

const deflate = (data: Uint8Array) => deflateSync(data)

/** A gradient with transparent stripes: rows favor different filters. */
function sample(width: number, height: number): Uint8Array {
  const rgba = new Uint8Array(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      rgba[i] = x * 7
      rgba[i + 1] = y * 5
      rgba[i + 2] = (x * y) & 0xff
      rgba[i + 3] = (x + y) % 9 === 0 ? 0 : x % 2 === 0 ? 255 : 128
    }
  }
  return rgba
}

describe('encodePng', () => {
  it('writes a valid PNG that decodes to the same pixels, partial alpha included', async () => {
    const rgba = sample(37, 23)
    const png = await encodePng(rgba, 37, 23, deflate)
    expect([...png.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    const decoded = readPng(png)
    expect([decoded.width, decoded.height]).toEqual([37, 23])
    expect(decoded.rgba).toEqual(rgba)
  })

  it('uses every row filter on images that favor them', async () => {
    const width = 64
    const rows = [
      () => 0x80,
      (x: number) => x * 4,
      () => 0x37,
      (x: number) => (x * 3) & 0xff,
      (x: number) => (x * x) & 0xff
    ]
    const rgba = new Uint8Array(width * rows.length * 4)
    rows.forEach((value, y) => {
      for (let x = 0; x < width; x++)
        rgba.fill(value(x), (y * width + x) * 4, (y * width + x) * 4 + 4)
    })
    const png = await encodePng(rgba, width, rows.length, deflate)
    expect(readPng(png).rgba).toEqual(rgba)
  })

  it('accepts an async deflate', async () => {
    const rgba = sample(8, 8)
    const png = await encodePng(rgba, 8, 8, async (data) => deflateSync(data))
    expect(readPng(png).rgba).toEqual(rgba)
  })

  it('encodes with CompressionStream as well', async () => {
    const rgba = sample(16, 16)
    expect(readPng(await encodePng(rgba, 16, 16, deflateWeb)).rgba).toEqual(rgba)
  })

  it('rejects a pixel buffer that does not match the size', async () => {
    await expect(encodePng(new Uint8Array(10), 2, 2, deflate)).rejects.toThrow(RangeError)
  })

  it('round-trips arbitrary images', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 12 }),
        fc.integer({ min: 1, max: 12 }),
        fc.infiniteStream(fc.integer({ min: 0, max: 255 })),
        async (width, height, values) => {
          const rgba = Uint8Array.from(values.take(width * height * 4))
          expect(readPng(await encodePng(rgba, width, height, deflate)).rgba).toEqual(rgba)
        }
      ),
      { numRuns: 100 }
    )
  })
})
