import { describe, expect, it } from 'vitest'
import { ParseError, UnsupportedVersionError } from '@paradox/utils'
import { Spr } from './spr.js'
import { SPR_SIGNATURES } from './spr-config.js'
import type { Sprite } from './types.js'

const SIG_772 = SPR_SIGNATURES[772]!

// Builds a minimal SPR header for v772 (non-extended: u16 count).
// addresses: array of u32 file offsets, one per sprite (1-based).
// spriteData: optional bytes appended after the address table.
function buildSpr(sig: number, addresses: number[], spriteData: number[] = []): Uint8Array {
  const count = addresses.length
  const headerSize = 6 // 4 sig + 2 count
  const tableSize = count * 4
  const totalSize = headerSize + tableSize + spriteData.length
  const buf = new DataView(new ArrayBuffer(totalSize))

  buf.setUint32(0, sig, true)
  buf.setUint16(4, count, true)
  for (let i = 0; i < count; i++) {
    buf.setUint32(6 + i * 4, addresses[i]!, true)
  }
  for (let i = 0; i < spriteData.length; i++) {
    buf.setUint8(headerSize + tableSize + i, spriteData[i]!)
  }

  return new Uint8Array(buf.buffer)
}

// Builds sprite data bytes: [colorKey 3b][spriteSize u16][runs...]
// Each run: [transparent u16][colored u16][r,g,b × colored]
function buildSpriteBytes(
  runs: Array<{ transparent: number; pixels: [number, number, number][] }>
): number[] {
  const runBytes: number[] = []
  for (const run of runs) {
    runBytes.push(run.transparent & 0xff, (run.transparent >> 8) & 0xff)
    runBytes.push(run.pixels.length & 0xff, (run.pixels.length >> 8) & 0xff)
    for (const [r, g, b] of run.pixels) {
      runBytes.push(r, g, b)
    }
  }
  const spriteSize = runBytes.length
  return [
    0xff,
    0x00,
    0xff, // color key
    spriteSize & 0xff,
    (spriteSize >> 8) & 0xff,
    ...runBytes
  ]
}

// Offset where sprite data starts after header + address table for N sprites
function spriteDataOffset(spriteCount: number): number {
  return 6 + spriteCount * 4
}

// ─── Constructor ──────────────────────────────────────────────────────────────

describe('Spr — constructor', () => {
  it('throws UnsupportedVersionError for unsupported version', () => {
    expect(() => Spr(999)).toThrow(UnsupportedVersionError)
  })
})

// ─── validate() ──────────────────────────────────────────────────────────────

describe('Spr — validate()', () => {
  it('does not throw for correct explicit-version signature', () => {
    const spr = Spr(772)
    expect(() => spr.validate(buildSpr(SIG_772, []))).not.toThrow()
  })

  it('throws ParseError for signature mismatch with explicit version', () => {
    const spr = Spr(772)
    expect(() => spr.validate(buildSpr(0xdeadbeef, []))).toThrow(ParseError)
  })

  it('error message includes version and both signatures', () => {
    const spr = Spr(772)
    expect(() => spr.validate(buildSpr(0xdeadbeef, []))).toThrowError('772')
  })

  it('throws ParseError for version 755 with wrong signature', () => {
    const spr = Spr(755)
    expect(() => spr.validate(new Uint8Array(4))).toThrow(ParseError) // zero sig ≠ 0x434f9cde
  })

  it('auto-detect mode accepts buffer with any known signature', () => {
    const spr = Spr()
    expect(() => spr.validate(buildSpr(SIG_772, []))).not.toThrow()
  })

  it('auto-detect mode throws ParseError for unknown signature', () => {
    const spr = Spr()
    expect(() => spr.validate(new Uint8Array(4))).toThrow(ParseError) // all zeros = unknown
  })
})

// ─── load() ──────────────────────────────────────────────────────────────────

describe('Spr — load()', () => {
  it('returns SprFile with correct count', () => {
    const file = Spr(772).load(buildSpr(SIG_772, [0, 0, 0]))
    expect(file.count).toBe(3)
  })

  it('each call to load() returns a fresh SprFile', () => {
    const spr = Spr(772)
    const buf = buildSpr(SIG_772, [0])
    const file1 = spr.load(buf)
    const file2 = spr.load(buf)
    expect(file1).not.toBe(file2)
    expect(file1.count).toBe(file2.count)
  })

  it('throws ParseError if address table exceeds file size', () => {
    // header claims count=100 but buffer is only 10 bytes
    const buf = new DataView(new ArrayBuffer(10))
    buf.setUint32(0, SIG_772, true)
    buf.setUint16(4, 100, true)
    expect(() => Spr(772).load(new Uint8Array(buf.buffer))).toThrow(ParseError)
  })

  it('uses u32 for count in extended sprites version (960)', () => {
    const sig960 = SPR_SIGNATURES[960]!
    // extended: 4 sig + 4 count + 1*4 address = 12 bytes
    const buf = new DataView(new ArrayBuffer(12))
    buf.setUint32(0, sig960, true)
    buf.setUint32(4, 1, true) // count as u32
    buf.setUint32(8, 0, true) // address[1] = 0
    const file = Spr(960).load(new Uint8Array(buf.buffer))
    expect(file.count).toBe(1)
  })

  it('SprFile exposes correct version and signature', () => {
    const file = Spr(772).load(buildSpr(SIG_772, [0]))
    expect(file.version).toBe(772)
    expect(file.signature).toBe(SIG_772)
  })

  it('auto-detect resolves version from signature', () => {
    const file = Spr().load(buildSpr(SIG_772, []))
    // 760/770/772 share signature; auto-detect returns first match
    expect([760, 770, 772]).toContain(file.version)
    expect(file.signature).toBe(SIG_772)
  })
})

// ─── get() ───────────────────────────────────────────────────────────────────

describe('SprFile — get()', () => {
  it('returns undefined for id = 0', () => {
    const file = Spr(772).load(buildSpr(SIG_772, [0]))
    expect(file.get(0)).toBeUndefined()
  })

  it('returns undefined for id > count', () => {
    const file = Spr(772).load(buildSpr(SIG_772, [0]))
    expect(file.get(2)).toBeUndefined()
  })

  it('returns transparent sprite for address = 0', () => {
    const file = Spr(772).load(buildSpr(SIG_772, [0]))
    const sprite = file.get(1)!
    expect(sprite.id).toBe(1)
    expect(sprite.width).toBe(32)
    expect(sprite.height).toBe(32)
    expect(sprite.rgba.length).toBe(4096)
    expect(sprite.rgba.every((b) => b === 0)).toBe(true)
  })

  it('parses a sprite with one colored pixel at position 0', () => {
    const dataOffset = spriteDataOffset(1)
    const spriteBytes = buildSpriteBytes([{ transparent: 0, pixels: [[100, 150, 200]] }])
    const file = Spr(772).load(buildSpr(SIG_772, [dataOffset], spriteBytes))
    const sprite = file.get(1)!
    expect(sprite.rgba[0]).toBe(100)
    expect(sprite.rgba[1]).toBe(150)
    expect(sprite.rgba[2]).toBe(200)
    expect(sprite.rgba[3]).toBe(255)
    // remaining pixels are transparent
    expect(sprite.rgba[4]).toBe(0)
  })

  it('places colored pixel at correct position after a transparent span', () => {
    const dataOffset = spriteDataOffset(1)
    // skip 5 pixels then 1 colored pixel → pixel index 5
    const spriteBytes = buildSpriteBytes([{ transparent: 5, pixels: [[10, 20, 30]] }])
    const file = Spr(772).load(buildSpr(SIG_772, [dataOffset], spriteBytes))
    const sprite = file.get(1)!
    // pixels 0-4 must be transparent
    expect(sprite.rgba[0]).toBe(0)
    // pixel 5: index = 5 * 4 = 20
    expect(sprite.rgba[20]).toBe(10)
    expect(sprite.rgba[21]).toBe(20)
    expect(sprite.rgba[22]).toBe(30)
    expect(sprite.rgba[23]).toBe(255)
  })

  it('handles multiple RLE runs in one sprite', () => {
    const dataOffset = spriteDataOffset(1)
    const spriteBytes = buildSpriteBytes([
      { transparent: 2, pixels: [[1, 2, 3]] },
      { transparent: 1, pixels: [[4, 5, 6]] }
    ])
    const file = Spr(772).load(buildSpr(SIG_772, [dataOffset], spriteBytes))
    const sprite = file.get(1)!
    // first colored pixel at index 2 → byte offset 8
    expect(sprite.rgba[8]).toBe(1)
    // second colored pixel at index 4 (2 transparent + 1 colored + 1 transparent) → byte offset 16
    expect(sprite.rgba[16]).toBe(4)
  })

  it('returns the same Sprite instance on second call (cache)', () => {
    const file = Spr(772).load(buildSpr(SIG_772, [0]))
    expect(file.get(1)).toBe(file.get(1))
  })
})

// ─── entries() ───────────────────────────────────────────────────────────────

describe('SprFile — entries()', () => {
  it('yields count entries', () => {
    const file = Spr(772).load(buildSpr(SIG_772, [0, 0, 0]))
    expect([...file.entries()]).toHaveLength(3)
  })

  it('yields [id, sprite] tuples with correct ids', () => {
    const file = Spr(772).load(buildSpr(SIG_772, [0, 0]))
    const entries = [...file.entries()]
    expect(entries[0]![0]).toBe(1)
    expect(entries[1]![0]).toBe(2)
  })

  it('yields sprites that are identical to get() results (cache shared)', () => {
    const file = Spr(772).load(buildSpr(SIG_772, [0, 0]))
    const fromEntries = [...file.entries()].map(([, s]) => s)
    expect(file.get(1)).toBe(fromEntries[0])
    expect(file.get(2)).toBe(fromEntries[1])
  })
})

// ─── helpers for write/writeStream tests ─────────────────────────────────────

function makeSpriteFixture(pixels: { index: number; r: number; g: number; b: number }[]): Sprite {
  const rgba = new Uint8Array(4096)
  for (const { index, r, g, b } of pixels) {
    rgba[index * 4] = r
    rgba[index * 4 + 1] = g
    rgba[index * 4 + 2] = b
    rgba[index * 4 + 3] = 255
  }
  return { id: 1, rgba, width: 32, height: 32 }
}

async function collectStream(gen: AsyncGenerator<Uint8Array>): Promise<Uint8Array> {
  const chunks: Uint8Array[] = []
  for await (const chunk of gen) chunks.push(chunk)
  const total = chunks.reduce((s, c) => s + c.length, 0)
  const out = new Uint8Array(total)
  let off = 0
  for (const c of chunks) {
    out.set(c, off)
    off += c.length
  }
  return out
}

// ─── write() ─────────────────────────────────────────────────────────────────

describe('Spr — write()', () => {
  it('round-trip: sprite with multiple runs is pixel-identical after write → load', () => {
    const original = makeSpriteFixture([
      { index: 0, r: 10, g: 20, b: 30 },
      { index: 5, r: 40, g: 50, b: 60 },
      { index: 10, r: 70, g: 80, b: 90 }
    ])
    const spr = Spr(772)
    const buf = spr.write([original])
    const file = spr.load(buf)
    const loaded = file.get(1)!
    expect(loaded.rgba).toEqual(original.rgba)
  })

  it('round-trip: null sprite preserved as address=0', () => {
    const spr = Spr(772)
    const buf = spr.write([null])
    const file = spr.load(buf)
    const sprite = file.get(1)!
    expect(sprite.rgba.every((b) => b === 0)).toBe(true)
  })

  it('round-trip: all-transparent sprite stays all-transparent after round-trip', () => {
    const rgba = new Uint8Array(4096)
    const s: Sprite = { id: 1, rgba, width: 32, height: 32 }
    const spr = Spr(772)
    const buf = spr.write([s])
    const file = spr.load(buf)
    expect(file.get(1)!.rgba.every((b) => b === 0)).toBe(true)
  })

  it('round-trip: pixel at last position (1023) survives write → load', () => {
    const original = makeSpriteFixture([{ index: 1023, r: 111, g: 222, b: 99 }])
    const spr = Spr(772)
    const file = spr.load(spr.write([original]))
    const loaded = file.get(1)!
    expect(loaded.rgba[1023 * 4]).toBe(111)
    expect(loaded.rgba[1023 * 4 + 1]).toBe(222)
    expect(loaded.rgba[1023 * 4 + 2]).toBe(99)
    expect(loaded.rgba[1023 * 4 + 3]).toBe(255)
  })

  it('duck-typing SprFile: spr.write(file) produces re-parseable buffer with same count', () => {
    const spr = Spr(772)
    const file = spr.load(buildSpr(SIG_772, [0, 0, 0]))
    const buf = spr.write(file)
    expect(spr.load(buf).count).toBe(file.count)
  })

  it('duck-typing array: spr.write([sprite, null, sprite]) produces equivalent output to object form', () => {
    const s = makeSpriteFixture([{ index: 2, r: 1, g: 2, b: 3 }])
    const spr = Spr(772)
    const fromArray = spr.write([s, null, s])
    const fromObj = spr.write({ count: 3, get: (id) => (id === 2 ? undefined : s) })
    expect(fromArray).toEqual(fromObj)
  })

  it('throws ParseError when version is undefined', () => {
    expect(() => Spr().write([null])).toThrow(ParseError)
    expect(() => Spr().write([null])).toThrowError(/version/i)
  })

  it('onProgress: called once per sprite, last value = 1, values non-decreasing', () => {
    const s = makeSpriteFixture([{ index: 0, r: 1, g: 2, b: 3 }])
    const values: number[] = []
    Spr(772).write([s, null, s], { onProgress: (pct) => values.push(pct) })
    expect(values).toHaveLength(3)
    expect(values[values.length - 1]).toBe(1)
    for (let i = 1; i < values.length; i++) {
      expect(values[i]!).toBeGreaterThanOrEqual(values[i - 1]!)
    }
  })
})

// ─── writeStream() ────────────────────────────────────────────────────────────

describe('Spr — writeStream()', () => {
  it('chunks concatenated equal write() output for same input', async () => {
    const s = makeSpriteFixture([{ index: 0, r: 5, g: 10, b: 15 }])
    const spr = Spr(772)
    const fromWrite = spr.write([s, null, s])
    const fromStream = await collectStream(spr.writeStream([s, null, s]))
    expect(fromStream).toEqual(fromWrite)
  })

  it('throws ParseError when version is undefined', async () => {
    await expect(collectStream(Spr().writeStream([null]))).rejects.toThrow(ParseError)
  })

  it('onProgress: fired for sprite chunks only (not header or table), values increasing', async () => {
    const s = makeSpriteFixture([{ index: 0, r: 1, g: 2, b: 3 }])
    const values: number[] = []
    await collectStream(
      Spr(772).writeStream([s, null, s], { onProgress: (pct) => values.push(pct) })
    )
    // 2 non-null sprites → 2 progress calls (null sprite produces no chunk)
    expect(values).toHaveLength(2)
    expect(values[0]!).toBeLessThan(values[1]!)
    expect(values[1]).toBe(1)
  })
})
