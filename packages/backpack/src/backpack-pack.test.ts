import { deflateSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { readPng } from '../tests/support/png-reader.js'
import { syntheticDat, syntheticOtb, syntheticSpr } from '../tests/support/synthetic-client.js'
import { StackOrder } from './backpack-flags.js'
import { buildPack } from './backpack-pack.js'

const deflate = (data: Uint8Array) => deflateSync(data)
const build = () =>
  buildPack({
    dat: syntheticDat(),
    spr: syntheticSpr(),
    otb: syntheticOtb(),
    deflate,
    maxPageSize: 64
  })

describe('buildPack', () => {
  it('keeps every sid and only the appearances items use', async () => {
    const pack = await build()
    expect(pack.items.sid).toEqual([2000, 2001, 2002, 2003, 2004, 2005, 2006, 2007])
    expect(pack.render.appearances.cid).toEqual([100, 101, 102, 103, 104, 105])
    expect(pack.items.appearance).toEqual([0, 1, 2, 3, 4, 5, 4, -1])
    expect(pack.manifest.counts).toEqual({
      items: 8,
      appearances: 6,
      frames: pack.render.frames.page.length
    })
    expect(pack.manifest).toMatchObject({
      schema: '1.0.0',
      client: 860,
      dat: '4C2C7993',
      spr: '12345678',
      lineage: { otbMajor: 3, otbMinor: 20 }
    })
  })

  it('points every sprite index at a frame, with the empty frame as 0', async () => {
    const { appearances: a, frames } = (await build()).render
    expect(a.frameStart).toEqual([0, 1, 2, 3, 7, 15])
    expect(a.frameIds.length).toBe(16)
    for (const id of a.frameIds) expect(id).toBeLessThan(frames.page.length)
    expect(a.frameIds[15]).toBe(0)
    expect(a.frameIds[5]).toBe(0) // the empty part of the 2x2
    expect([frames.page[0], frames.w[0], frames.h[0]]).toEqual([-1, 0, 0])
    expect(a.opaque).toEqual([1, 0, 1, 0, 0, 0]) // 102 has an opaque bottom layer
  })

  it('places frames inside their pages, grounds and borders first, trimmed', async () => {
    const pack = await build()
    const { frames, appearances } = pack.render
    for (let f = 1; f < frames.page.length; f++) {
      const page = pack.manifest.pages[frames.page[f]!]!
      expect(frames.x[f]! + frames.w[f]!).toBeLessThanOrEqual(page.width)
      expect(frames.y[f]! + frames.h[f]!).toBeLessThanOrEqual(page.height)
    }
    const ground =
      appearances.frameIds[appearances.frameStart[appearances.order.indexOf(StackOrder.Ground)]!]!
    expect([frames.page[ground], frames.x[ground], frames.y[ground]]).toEqual([0, 0, 0])
    const border = appearances.frameIds[1]!
    expect([frames.w[border], frames.h[border], frames.offsetX[border]]).toEqual([4, 4, 2])
  })

  it('draws each frame at its place in the page', async () => {
    const pack = await build()
    const { frames, appearances } = pack.render
    const f = appearances.frameIds[appearances.frameStart[3]!]! // 2x2 part (0, 0): sprite 4
    const page = readPng(pack.pages[frames.page[f]!]!)
    expect(page.width).toBe(pack.manifest.pages[frames.page[f]!]!.width)
    expect(page.rgba[(frames.y[f]! * page.width + frames.x[f]!) * 4]).toBe(4)
  })

  it('declares sid = cid without an OTB', async () => {
    const pack = await buildPack({ dat: syntheticDat(), spr: syntheticSpr(), deflate })
    expect(pack.manifest.lineage).toBeNull()
    expect(pack.items.sid).toEqual([100, 101, 102, 103, 104, 105, 106])
  })
})
