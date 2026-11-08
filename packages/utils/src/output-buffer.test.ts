import { describe, expect, it } from 'vitest'
import { createOutputBuffer } from './output-buffer.js'

const bytes = (...values: number[]) => Uint8Array.from(values)

describe('createOutputBuffer', () => {
  it('writes raw little-endian values without escaping', () => {
    const out = createOutputBuffer()
    out.u8(0xfe)
    out.u16(0xfffd)
    out.u32(0x01020304)
    out.bytes(bytes(0xff))
    expect(out.take()).toEqual(bytes(0xfe, 0xfd, 0xff, 4, 3, 2, 1, 0xff))
  })

  it('escapes 0xfd, 0xfe and 0xff in every escaped width', () => {
    const out = createOutputBuffer()
    out.escU8(0xfd)
    out.escU8(0xfc)
    out.escU16(0xfeff)
    out.escU32(0xfd00fe01)
    out.escBytes(bytes(0xff, 0x10))
    expect(out.take()).toEqual(
      bytes(
        0xfd,
        0xfd,
        0xfc,
        0xfd,
        0xff,
        0xfd,
        0xfe,
        1,
        0xfd,
        0xfe,
        0,
        0xfd,
        0xfd,
        0xfd,
        0xff,
        0x10
      )
    )
  })

  it('writes 64-bit values above 2^32', () => {
    const out = createOutputBuffer()
    out.escU64(2 ** 40 + 5)
    expect(out.take()).toEqual(bytes(5, 0, 0, 0, 0, 1, 0, 0))
  })

  it('grows past its initial capacity and keeps every byte', () => {
    const out = createOutputBuffer({ initialBytes: 16 })
    for (let i = 0; i < 1000; i++) out.escU16(i)
    const taken = out.take()
    expect(taken.length).toBeGreaterThanOrEqual(2000)
    expect(taken[0]).toBe(0)
    expect(taken.at(-1)).toBe(3) // 999 = 0x03e7
  })

  it('take() returns only what was written since the previous take()', () => {
    const out = createOutputBuffer({ initialBytes: 16 })
    out.u8(1)
    out.u8(2)
    expect(out.take()).toEqual(bytes(1, 2))
    expect(out.length).toBe(0)
    out.u8(3)
    expect(out.take()).toEqual(bytes(3))
  })

  it('take() hands out a copy that later writes do not touch', () => {
    const out = createOutputBuffer()
    out.u8(1)
    const first = out.take()
    out.u8(9)
    expect(first).toEqual(bytes(1))
  })

  it('truncate() drops a group written after a mark', () => {
    const out = createOutputBuffer()
    out.u8(1)
    const mark = out.mark()
    out.u32(0xffffffff)
    out.truncate(mark)
    out.u8(2)
    expect(out.take()).toEqual(bytes(1, 2))
  })

  it('truncate() rejects a mark outside the written range', () => {
    const out = createOutputBuffer()
    out.u8(1)
    expect(() => out.truncate(5)).toThrow(RangeError)
    expect(() => out.truncate(-1)).toThrow(RangeError)
  })
})
