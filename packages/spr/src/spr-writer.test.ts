import { describe, expect, it, vi } from 'vitest'
import { serializeSpr } from './spr-writer.js'
import { SPR_SIGNATURES } from './spr-config.js'
import type { Sprite, SprWriteInput } from './types.js'
import type { SprFile } from './spr.js'

const SIG_772 = SPR_SIGNATURES[772]!
const SIG_960 = SPR_SIGNATURES[960]!

function makeSprite(pixels: { index: number; r: number; g: number; b: number }[]): Sprite {
  const rgba = new Uint8Array(4096)
  for (const { index, r, g, b } of pixels) {
    rgba[index * 4] = r
    rgba[index * 4 + 1] = g
    rgba[index * 4 + 2] = b
    rgba[index * 4 + 3] = 255
  }
  return { id: 1, rgba, width: 32, height: 32 }
}

function readU16LE(buf: Uint8Array, offset: number): number {
  return buf[offset]! | (buf[offset + 1]! << 8)
}

function readU32LE(buf: Uint8Array, offset: number): number {
  return (
    (buf[offset]! |
      (buf[offset + 1]! << 8) |
      (buf[offset + 2]! << 16) |
      (buf[offset + 3]! * 0x1000000)) >>>
    0
  )
}

function concat(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((s, c) => s + c.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const c of chunks) {
    out.set(c, offset)
    offset += c.length
  }
  return out
}

// ─── chunk count ─────────────────────────────────────────────────────────────

describe('serializeSpr — chunk structure', () => {
  it('1 null + 2 sprites → 4 chunks (header + table + 2 sprite chunks)', () => {
    const s = makeSprite([{ index: 0, r: 1, g: 2, b: 3 }])
    const chunks = serializeSpr([null, s, s], 772)
    expect(chunks).toHaveLength(4)
  })

  it('all null sprites → 2 chunks (header + table only)', () => {
    const chunks = serializeSpr([null, null], 772)
    expect(chunks).toHaveLength(2)
  })
})

// ─── header ──────────────────────────────────────────────────────────────────

describe('serializeSpr — header', () => {
  it('non-extended (772): header is 6 bytes with sig u32 + count u16', () => {
    const chunks = serializeSpr([null, null, null], 772)
    const header = chunks[0]!
    expect(header.length).toBe(6)
    expect(readU32LE(header, 0)).toBe(SIG_772)
    expect(readU16LE(header, 4)).toBe(3)
  })

  it('extended (960): header is 8 bytes with sig u32 + count u32', () => {
    const chunks = serializeSpr([null, null, null], 960)
    const header = chunks[0]!
    expect(header.length).toBe(8)
    expect(readU32LE(header, 0)).toBe(SIG_960)
    expect(readU32LE(header, 4)).toBe(3)
  })
})

// ─── address table ────────────────────────────────────────────────────────────

describe('serializeSpr — address table', () => {
  it('null sprite → address 0 in table', () => {
    const chunks = serializeSpr([null], 772)
    const table = chunks[1]!
    expect(readU32LE(table, 0)).toBe(0)
  })

  it('non-null sprite → non-zero address in table', () => {
    const s = makeSprite([{ index: 0, r: 10, g: 20, b: 30 }])
    const chunks = serializeSpr([s], 772)
    const table = chunks[1]!
    expect(readU32LE(table, 0)).toBeGreaterThan(0)
  })

  it('first sprite offset = headerSize + tableSize', () => {
    const s = makeSprite([{ index: 0, r: 1, g: 2, b: 3 }])
    const chunks = serializeSpr([s], 772)
    const table = chunks[1]!
    const expectedOffset = 6 + 1 * 4 // headerSize=6, count=1
    expect(readU32LE(table, 0)).toBe(expectedOffset)
  })

  it('second sprite offset = first offset + first chunk size', () => {
    const s = makeSprite([{ index: 0, r: 1, g: 2, b: 3 }])
    const chunks = serializeSpr([s, s], 772)
    const table = chunks[1]!
    const addr1 = readU32LE(table, 0)
    const addr2 = readU32LE(table, 4)
    const chunk1Size = chunks[2]!.length
    expect(addr2).toBe(addr1 + chunk1Size)
  })

  it('null between two sprites leaves a gap in addresses', () => {
    const s = makeSprite([{ index: 0, r: 1, g: 2, b: 3 }])
    const chunks = serializeSpr([s, null, s], 772)
    const table = chunks[1]!
    expect(readU32LE(table, 0)).toBeGreaterThan(0) // sprite 1
    expect(readU32LE(table, 4)).toBe(0) // null
    expect(readU32LE(table, 8)).toBeGreaterThan(0) // sprite 3
  })
})

// ─── sprite chunk layout ──────────────────────────────────────────────────────

describe('serializeSpr — sprite chunk layout', () => {
  it('chunk starts with color key [0xFF, 0x00, 0xFF]', () => {
    const s = makeSprite([{ index: 0, r: 1, g: 2, b: 3 }])
    const chunks = serializeSpr([s], 772)
    const chunk = chunks[2]!
    expect(chunk[0]).toBe(0xff)
    expect(chunk[1]).toBe(0x00)
    expect(chunk[2]).toBe(0xff)
  })

  it('all-transparent sprite: spriteSize=0, chunk = 5 bytes', () => {
    const rgba = new Uint8Array(4096) // all zeros = all transparent
    const s: Sprite = { id: 1, rgba, width: 32, height: 32 }
    const chunks = serializeSpr([s], 772)
    const chunk = chunks[2]!
    expect(chunk.length).toBe(5)
    expect(chunk[3]).toBe(0) // spriteSize low byte
    expect(chunk[4]).toBe(0) // spriteSize high byte
  })
})

// ─── RLE encoding ─────────────────────────────────────────────────────────────

describe('serializeSpr — RLE encoding', () => {
  it('pixel at position 0: run [0,0][1,1][r,g,b]', () => {
    const s = makeSprite([{ index: 0, r: 100, g: 150, b: 200 }])
    const chunks = serializeSpr([s], 772)
    const chunk = chunks[2]!
    // after color key (3) + spriteSize u16 (2) = offset 5
    expect(readU16LE(chunk, 5)).toBe(0) // transparentCount
    expect(readU16LE(chunk, 7)).toBe(1) // coloredCount
    expect(chunk[9]).toBe(100) // r
    expect(chunk[10]).toBe(150) // g
    expect(chunk[11]).toBe(200) // b
  })

  it('pixel at position 5: run [5,0][1,1][r,g,b]', () => {
    const s = makeSprite([{ index: 5, r: 10, g: 20, b: 30 }])
    const chunks = serializeSpr([s], 772)
    const chunk = chunks[2]!
    expect(readU16LE(chunk, 5)).toBe(5) // transparentCount
    expect(readU16LE(chunk, 7)).toBe(1) // coloredCount
    expect(chunk[9]).toBe(10) // r
    expect(chunk[10]).toBe(20) // g
    expect(chunk[11]).toBe(30) // b
  })

  it('two colored segments separated by gap → two runs', () => {
    const s = makeSprite([
      { index: 0, r: 1, g: 2, b: 3 },
      { index: 3, r: 4, g: 5, b: 6 }
    ])
    const chunks = serializeSpr([s], 772)
    const chunk = chunks[2]!
    // run 1 at offset 5: transparent=0, colored=1, [1,2,3]
    expect(readU16LE(chunk, 5)).toBe(0) // transparent
    expect(readU16LE(chunk, 7)).toBe(1) // colored
    expect(chunk[9]).toBe(1) // r

    // run 2 after run 1: 4 + 4 + 3 = 11 bytes per run
    // run1: [u16][u16][r,g,b] = 2+2+3 = 7 bytes; offset = 5 + 7 = 12
    expect(readU16LE(chunk, 12)).toBe(2) // gap of 2 (pixels 1,2 transparent)
    expect(readU16LE(chunk, 14)).toBe(1) // colored
    expect(chunk[16]).toBe(4) // r
  })

  it('trailing transparent pixels are implicit — no trailing run', () => {
    const s = makeSprite([{ index: 500, r: 1, g: 2, b: 3 }])
    const chunks = serializeSpr([s], 772)
    const chunk = chunks[2]!
    // spriteSize: [u16 transparent=500][u16 colored=1][r,g,b] = 2+2+3 = 7 bytes
    const spriteSize = readU16LE(chunk, 3)
    expect(spriteSize).toBe(7)
  })
})

// ─── onSprite callback ────────────────────────────────────────────────────────

describe('serializeSpr — onSprite callback', () => {
  it('called once per sprite (null or non-null)', () => {
    const s = makeSprite([{ index: 0, r: 1, g: 2, b: 3 }])
    const cb = vi.fn()
    serializeSpr([null, s, null], 772, cb)
    expect(cb).toHaveBeenCalledTimes(3)
  })

  it('receives (index, total) with 0-based index', () => {
    const cb = vi.fn()
    serializeSpr([null, null], 772, cb)
    expect(cb).toHaveBeenNthCalledWith(1, 0, 2)
    expect(cb).toHaveBeenNthCalledWith(2, 1, 2)
  })
})

// ─── input duck-typing ────────────────────────────────────────────────────────

describe('serializeSpr — SprWriteInput duck-typing', () => {
  it('SprFile satisfies SprWriteInput structurally (compile-time check)', () => {
    const _: SprWriteInput = {} as SprFile
    expect(_).toBeDefined()
  })

  it('object with count+get is handled via get(id) iteration', () => {
    const s = makeSprite([{ index: 0, r: 7, g: 8, b: 9 }])
    const input: SprWriteInput = { count: 2, get: (id) => (id === 1 ? s : undefined) }
    const chunks = serializeSpr(input, 772)
    const table = chunks[1]!
    expect(readU32LE(table, 0)).toBeGreaterThan(0) // sprite 1 has data
    expect(readU32LE(table, 4)).toBe(0) // sprite 2 is undefined → null
  })

  it('array input [sprite, null, sprite] produces same result as equivalent object input', () => {
    const s = makeSprite([{ index: 0, r: 1, g: 2, b: 3 }])
    const fromArray = concat(serializeSpr([s, null, s], 772))
    const fromObj: SprWriteInput = {
      count: 3,
      get: (id) => (id === 2 ? undefined : s)
    }
    const fromObject = concat(serializeSpr(fromObj, 772))
    expect(fromArray).toEqual(fromObject)
  })
})
