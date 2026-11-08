import { describe, expect, it } from 'vitest'
import { fixtures, readFixture } from '@paradoxlab/fixtures'
import { Spr } from '@paradoxlab/spr'
import { deflateNode } from '../src/backpack-node.js'
import { buildSpriteSheet } from '../src/backpack-sprites.js'
import { readPng } from './support/png-reader.js'

/** Every sprite read back from the decoded pages must equal the `.spr` pixel for pixel. */
async function expectLossless(client: string, trim: boolean): Promise<void> {
  const spr = Spr(Number(client)).load(readFixture(fixtures().clientFixture(client)!.spr))
  const sheet = await buildSpriteSheet(spr, { deflate: deflateNode, trim })
  for (const page of sheet.json.meta.pages) {
    expect(page.width).toBeLessThanOrEqual(4096)
    expect(page.height).toBeLessThanOrEqual(4096)
  }
  const pages = sheet.pages.map(readPng)
  const f = sheet.json.frames
  let mismatches = 0
  for (let i = 0; i < f.id.length; i++) {
    const source = spr.get(f.id[i]!)!.rgba
    const page = pages[f.page[i]!]
    for (let y = 0; y < 32; y++) {
      for (let x = 0; x < 32; x++) {
        const from = (y * 32 + x) * 4
        const inside =
          x >= f.offsetX[i]! &&
          x < f.offsetX[i]! + f.w[i]! &&
          y >= f.offsetY[i]! &&
          y < f.offsetY[i]! + f.h[i]!
        for (let c = 0; c < 4; c++) {
          const expected = source[from + c]!
          // Outside the packed rectangle (trimmed away) only fully transparent pixels may exist.
          const actual =
            inside && page !== undefined
              ? page.rgba[
                  ((f.y[i]! + y - f.offsetY[i]!) * page.width + f.x[i]! + x - f.offsetX[i]!) * 4 + c
                ]!
              : source[from + 3] === 0
                ? expected
                : -1
          if (actual !== expected) mismatches++
        }
      }
    }
  }
  expect(mismatches).toBe(0)
}

describe('sprite sheets from real clients are lossless', () => {
  for (const client of ['772', '1098']) {
    const present = fixtures().clientFixture(client) !== undefined
    it.skipIf(!present)(`${client}, untrimmed`, () => expectLossless(client, false), 600_000)
    it.skipIf(!present)(`${client}, trimmed`, () => expectLossless(client, true), 600_000)
  }
})
