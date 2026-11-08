import { describe, expect, it } from 'vitest'
import { createBinaryWriter } from './binary-writer.js'

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
