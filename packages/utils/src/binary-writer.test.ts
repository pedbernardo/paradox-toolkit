import { describe, expect, it } from 'vitest'
import { createBinaryWriter, createEscapedBinaryWriter } from './binary-writer.js'

describe('createBinaryWriter', () => {
  it('u8: writes a single byte', () => {
    const w = createBinaryWriter()
    w.u8(0x42)
    expect(w.finish()).toEqual(new Uint8Array([0x42]))
  })

  it('u8: multiple u8 in sequence', () => {
    const w = createBinaryWriter()
    w.u8(0x01)
    w.u8(0x02)
    w.u8(0x03)
    expect(w.finish()).toEqual(new Uint8Array([0x01, 0x02, 0x03]))
  })

  it('u16: little-endian (0x0102 → [0x02, 0x01])', () => {
    const w = createBinaryWriter()
    w.u16(0x0102)
    expect(w.finish()).toEqual(new Uint8Array([0x02, 0x01]))
  })

  it('u32: little-endian (0x01020304 → [0x04, 0x03, 0x02, 0x01])', () => {
    const w = createBinaryWriter()
    w.u32(0x01020304)
    expect(w.finish()).toEqual(new Uint8Array([0x04, 0x03, 0x02, 0x01]))
  })

  it('u32: high bit set (0x80000001 → [0x01, 0x00, 0x00, 0x80])', () => {
    const w = createBinaryWriter()
    w.u32(0x80000001)
    expect(w.finish()).toEqual(new Uint8Array([0x01, 0x00, 0x00, 0x80]))
  })

  it('str: writes u16(length) + latin-1 bytes', () => {
    const w = createBinaryWriter()
    w.str('AB')
    expect(w.finish()).toEqual(new Uint8Array([0x02, 0x00, 0x41, 0x42]))
  })

  it('bytes: copies slice correctly', () => {
    const w = createBinaryWriter()
    w.bytes(new Uint8Array([0x0a, 0x0b, 0x0c]))
    expect(w.finish()).toEqual(new Uint8Array([0x0a, 0x0b, 0x0c]))
  })

  it('finish() returns only the bytes written (not the full buffer)', () => {
    const w = createBinaryWriter()
    w.u8(0x01)
    w.u8(0x02)
    expect(w.finish()).toHaveLength(2)
  })

  it('finish() after growth: content is correct after buffer doubling', () => {
    const w = createBinaryWriter()
    const big = new Uint8Array(70000).fill(0xaa)
    w.bytes(big)
    const result = w.finish()
    expect(result).toHaveLength(70000)
    expect(result[0]).toBe(0xaa)
    expect(result[69999]).toBe(0xaa)
  })

  it('length tracks bytes written', () => {
    const w = createBinaryWriter()
    expect(w.length).toBe(0)
    w.u8(0x01)
    expect(w.length).toBe(1)
    w.u16(0x0102)
    expect(w.length).toBe(3)
    w.u32(0)
    expect(w.length).toBe(7)
  })
})

describe('createEscapedBinaryWriter', () => {
  it('escU8(0x00): no escape needed', () => {
    const w = createEscapedBinaryWriter()
    w.escU8(0x00)
    expect(w.finish()).toEqual(new Uint8Array([0x00]))
  })

  it('escU8(0xFD): escapes to [0xFD, 0xFD]', () => {
    const w = createEscapedBinaryWriter()
    w.escU8(0xfd)
    expect(w.finish()).toEqual(new Uint8Array([0xfd, 0xfd]))
  })

  it('escU8(0xFE): escapes to [0xFD, 0xFE]', () => {
    const w = createEscapedBinaryWriter()
    w.escU8(0xfe)
    expect(w.finish()).toEqual(new Uint8Array([0xfd, 0xfe]))
  })

  it('escU8(0xFF): escapes to [0xFD, 0xFF]', () => {
    const w = createEscapedBinaryWriter()
    w.escU8(0xff)
    expect(w.finish()).toEqual(new Uint8Array([0xfd, 0xff]))
  })

  it('escU16: each byte >= 0xFD is escaped independently', () => {
    // 0x01FE → bytes [0xFE, 0x01]; 0xFE needs escape, 0x01 does not
    const w = createEscapedBinaryWriter()
    w.escU16(0x01fe)
    expect(w.finish()).toEqual(new Uint8Array([0xfd, 0xfe, 0x01]))
  })

  it('escU32: all bytes >= 0xFD escaped independently', () => {
    // 0xFDFEFF00 → bytes little-endian [0x00, 0xFF, 0xFE, 0xFD]
    const w = createEscapedBinaryWriter()
    w.escU32(0xfdfeff00)
    expect(w.finish()).toEqual(
      new Uint8Array([
        0x00, // no escape
        0xfd,
        0xff, // 0xFF escaped
        0xfd,
        0xfe, // 0xFE escaped
        0xfd,
        0xfd // 0xFD escaped
      ])
    )
  })

  it('escStr: writes escaped u16 length + escaped bytes', () => {
    const w = createEscapedBinaryWriter()
    w.escStr('A')
    // escU16(1) = [0x01, 0x00], then escaped(0x41) = [0x41]
    expect(w.finish()).toEqual(new Uint8Array([0x01, 0x00, 0x41]))
  })

  it('escStr: string containing 0xFD byte (latin-1) is escaped correctly', () => {
    const w = createEscapedBinaryWriter()
    w.escStr('\xfd')
    // escU16(1) = [0x01, 0x00], then escaped(0xFD) = [0xFD, 0xFD]
    expect(w.finish()).toEqual(new Uint8Array([0x01, 0x00, 0xfd, 0xfd]))
  })

  it('raw writes (u8, u16) in escaped writer do not apply escape', () => {
    const w = createEscapedBinaryWriter()
    w.u8(0xff) // raw - no escape
    w.escU8(0xff) // escaped
    expect(w.finish()).toEqual(new Uint8Array([0xff, 0xfd, 0xff]))
  })

  it('length property reflects raw byte count written (including escape prefix bytes)', () => {
    const w = createEscapedBinaryWriter()
    w.escU8(0xfe) // writes 2 bytes: 0xFD + 0xFE
    expect(w.length).toBe(2)
    w.escU8(0x01) // writes 1 byte: 0x01
    expect(w.length).toBe(3)
  })

  it('escU64(0): writes 8 zero bytes', () => {
    const w = createEscapedBinaryWriter()
    w.escU64(0)
    expect(w.finish()).toEqual(new Uint8Array(8))
  })

  it('escU64: little-endian lo+hi u32 layout', () => {
    const w = createEscapedBinaryWriter()
    w.escU64(0x0000000100000002)
    expect(w.finish()).toEqual(new Uint8Array([0x02, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00]))
  })

  it('escU64: lo byte >= 0xFD is escaped', () => {
    const w = createEscapedBinaryWriter()
    w.escU64(254) // lo=0xFE, hi=0 → escaped lo byte
    expect(w.finish()).toEqual(
      new Uint8Array([0xfd, 0xfe, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00])
    )
  })

  it('escBytes: writes each byte escaped independently', () => {
    const w = createEscapedBinaryWriter()
    w.escBytes(new Uint8Array([0x01, 0x02, 0x03]))
    expect(w.finish()).toEqual(new Uint8Array([0x01, 0x02, 0x03]))
  })

  it('escBytes: byte >= 0xFD in array is escaped', () => {
    const w = createEscapedBinaryWriter()
    w.escBytes(new Uint8Array([0x01, 0xfe, 0x03]))
    expect(w.finish()).toEqual(new Uint8Array([0x01, 0xfd, 0xfe, 0x03]))
  })

  it('escBytes: empty array writes nothing', () => {
    const w = createEscapedBinaryWriter()
    w.escBytes(new Uint8Array(0))
    expect(w.finish()).toHaveLength(0)
  })

  it('u16: delegates to base writer (little-endian)', () => {
    const w = createEscapedBinaryWriter()
    w.u16(0x0102)
    expect(w.finish()).toEqual(new Uint8Array([0x02, 0x01]))
  })

  it('u32: delegates to base writer (little-endian)', () => {
    const w = createEscapedBinaryWriter()
    w.u32(0x01020304)
    expect(w.finish()).toEqual(new Uint8Array([0x04, 0x03, 0x02, 0x01]))
  })

  it('str: delegates to base writer (u16 length + latin-1 bytes)', () => {
    const w = createEscapedBinaryWriter()
    w.str('AB')
    expect(w.finish()).toEqual(new Uint8Array([0x02, 0x00, 0x41, 0x42]))
  })

  it('bytes: delegates to base writer (raw copy)', () => {
    const w = createEscapedBinaryWriter()
    w.bytes(new Uint8Array([0x0a, 0x0b, 0x0c]))
    expect(w.finish()).toEqual(new Uint8Array([0x0a, 0x0b, 0x0c]))
  })
})
