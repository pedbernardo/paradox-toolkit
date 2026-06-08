import { describe, expect, it } from 'vitest'
import { ParseError, UnsupportedVersionError } from '@paradox/utils'
import { Dat } from './dat.js'
import { DAT_SIGNATURES } from './dat-config.js'
import { getDatFlags } from './dat-flags.js'

// Builds a minimal valid DAT binary for version 772:
// [u32 signature][u16 itemsMaxCid][u16 creatures][u16 effects][u16 missiles]
// [item 100: 0xFF end-of-flags, layout 1x1x1x1x1x1x1, 1x u16 spriteId]
function buildMinimalDat772(): Uint8Array {
  const sig = DAT_SIGNATURES[772]!
  const buf = new DataView(new ArrayBuffer(4 + 8 + 10))

  // signature (little-endian u32)
  buf.setUint32(0, sig, true)
  // header: itemsMaxCid=100, creatures=0, effects=0, missiles=0
  buf.setUint16(4, 100, true) // itemsMaxCid = 100 (1 item: cid 100)
  buf.setUint16(6, 0, true)
  buf.setUint16(8, 0, true)
  buf.setUint16(10, 0, true)
  // item 100: end-of-flags(0xFF), width=1, height=1, layers=1, patX=1, patY=1, patZ=1, frames=1
  buf.setUint8(12, 0xff) // DAT_FLAG_END_MARK
  buf.setUint8(13, 1) // width
  buf.setUint8(14, 1) // height
  buf.setUint8(15, 1) // layers
  buf.setUint8(16, 1) // patternX
  buf.setUint8(17, 1) // patternY
  buf.setUint8(18, 1) // patternZ
  buf.setUint8(19, 1) // frames
  buf.setUint16(20, 42, true) // spriteId = 42

  return new Uint8Array(buf.buffer)
}

// Builds a DAT binary for version 960 with one item that has a MARKET flag.
// MARKET payload: u16 category, u16 tradeAs, u16 showAs, u16 nameLen, bytes name, u16 restrictVocation, u16 requiredLevel
function buildMarketDat960(): Uint8Array {
  const sig = DAT_SIGNATURES[960]!
  const flags960 = getDatFlags(960)
  const marketByte = flags960['MARKET']!
  const name = 'Gold Coin'
  const nameBytes = Array.from(name).map((c) => c.charCodeAt(0))

  // item bytes: marketFlag + payload + 0xFF (end) + layout(7 bytes) + sprite(4 bytes u32)
  const payloadSize = 2 + 2 + 2 + 2 + nameBytes.length + 2 + 2 // 14 + nameLen bytes
  const itemSize = 1 + payloadSize + 1 + 7 + 4

  const ab = new ArrayBuffer(4 + 8 + itemSize)
  const buf = new DataView(ab)
  let off = 0

  buf.setUint32(off, sig, true)
  off += 4
  buf.setUint16(off, 100, true)
  off += 2 // itemsMaxCid
  buf.setUint16(off, 0, true)
  off += 2
  buf.setUint16(off, 0, true)
  off += 2
  buf.setUint16(off, 0, true)
  off += 2

  // MARKET flag byte
  buf.setUint8(off++, marketByte)
  buf.setUint16(off, 3, true)
  off += 2 // category
  buf.setUint16(off, 100, true)
  off += 2 // tradeAs
  buf.setUint16(off, 200, true)
  off += 2 // showAs
  buf.setUint16(off, nameBytes.length, true)
  off += 2 // nameLen
  for (const b of nameBytes) {
    buf.setUint8(off++, b)
  }
  buf.setUint16(off, 1, true)
  off += 2 // restrictVocation
  buf.setUint16(off, 50, true)
  off += 2 // requiredLevel

  // end-of-flags
  buf.setUint8(off++, 0xff)

  // layout: width=1, height=1, layers=1, patX=1, patY=1, patZ=1 (patternZ feature on 960), frames=1
  buf.setUint8(off++, 1) // width
  buf.setUint8(off++, 1) // height
  buf.setUint8(off++, 1) // layers
  buf.setUint8(off++, 1) // patternX
  buf.setUint8(off++, 1) // patternY
  buf.setUint8(off++, 1) // patternZ
  buf.setUint8(off++, 1) // frames
  buf.setUint32(off, 7, true) // spriteId = 7 (u32 — extendedSprites on 960)

  return new Uint8Array(ab)
}

// Builds a DAT binary for version 1098 with one item that has 2 frames and animation data.
// frameDurations feature: async(u8) + loopCount(i32) + startPhase(i8) + frames*(min u32 + max u32)
function buildAnimationDat1098(): Uint8Array {
  const sig = DAT_SIGNATURES[1098]!

  // item bytes: 0xFF (end-of-flags) + layout(7 bytes) + animData(6 + 2*8 = 22 bytes) + 2 sprites(u32 each)
  const frames = 2
  const animSize = 1 + 4 + 1 + frames * 8 // async(1) + loopCount(4) + startPhase(1) + frames*(min4+max4)
  const itemSize = 1 + 7 + animSize + frames * 4

  const ab = new ArrayBuffer(4 + 8 + itemSize)
  const buf = new DataView(ab)
  let off = 0

  buf.setUint32(off, sig, true)
  off += 4
  buf.setUint16(off, 100, true)
  off += 2 // itemsMaxCid
  buf.setUint16(off, 0, true)
  off += 2
  buf.setUint16(off, 0, true)
  off += 2
  buf.setUint16(off, 0, true)
  off += 2

  // end-of-flags
  buf.setUint8(off++, 0xff)

  // layout: width=1, height=1, layers=1, patX=1, patY=1, patZ=1, frames=2
  buf.setUint8(off++, 1) // width
  buf.setUint8(off++, 1) // height
  buf.setUint8(off++, 1) // layers
  buf.setUint8(off++, 1) // patternX
  buf.setUint8(off++, 1) // patternY
  buf.setUint8(off++, 1) // patternZ
  buf.setUint8(off++, frames) // frames = 2

  // AnimationData: async=1(true), loopCount=-1 (0xFFFFFFFF), startPhase=-1 (0xFF), phaseDurations
  buf.setUint8(off++, 1) // async = true
  buf.setInt32(off, -1, true)
  off += 4 // loopCount = -1
  buf.setInt8(off++, -1) // startPhase = -1
  // phase 0: min=100, max=200
  buf.setUint32(off, 100, true)
  off += 4
  buf.setUint32(off, 200, true)
  off += 4
  // phase 1: min=50, max=150
  buf.setUint32(off, 50, true)
  off += 4
  buf.setUint32(off, 150, true)
  off += 4

  // sprites (2 x u32 since extendedSprites on 1098)
  buf.setUint32(off, 10, true)
  off += 4
  buf.setUint32(off, 11, true)

  return new Uint8Array(ab)
}

// Builds a DAT binary for version 1098 with one creature that has 2 frame groups.
function buildFrameGroupsDat1098(): Uint8Array {
  const sig = DAT_SIGNATURES[1098]!

  // creature layout: 1x1x1x1x1x1x1 (no animation), 1 sprite u32
  const layoutSize = 7 // w+h+layers+patX+patY+patZ+frames
  const spriteSize = 4 // 1 sprite u32

  // groupCount(1) + 2 groups: each groupType(1) + layout(7) + sprite(4)
  const groupsSize = 1 + 2 * (1 + layoutSize + spriteSize)
  // creature bytes: 0xFF + groupsData
  const creatureSize = 1 + groupsSize

  const ab = new ArrayBuffer(4 + 8 + creatureSize)
  const buf = new DataView(ab)
  let off = 0

  buf.setUint32(off, sig, true)
  off += 4
  buf.setUint16(off, 99, true)
  off += 2 // itemsMaxCid (no items, just 99 as placeholder)
  buf.setUint16(off, 1, true)
  off += 2 // creatures = 1
  buf.setUint16(off, 0, true)
  off += 2
  buf.setUint16(off, 0, true)
  off += 2

  // creature 1: end-of-flags
  buf.setUint8(off++, 0xff)

  // groupCount = 2
  buf.setUint8(off++, 2)

  // group 0: groupType=0 (idle), layout 1x1x1x1x1x1x1, spriteId=5
  buf.setUint8(off++, 0) // groupType = idle
  buf.setUint8(off++, 1) // width
  buf.setUint8(off++, 1) // height
  buf.setUint8(off++, 1) // layers
  buf.setUint8(off++, 1) // patternX
  buf.setUint8(off++, 1) // patternY
  buf.setUint8(off++, 1) // patternZ
  buf.setUint8(off++, 1) // frames
  buf.setUint32(off, 5, true)
  off += 4 // spriteId = 5

  // group 1: groupType=1 (moving), layout 1x1x1x1x1x1x1, spriteId=6
  buf.setUint8(off++, 1) // groupType = moving
  buf.setUint8(off++, 1)
  buf.setUint8(off++, 1)
  buf.setUint8(off++, 1)
  buf.setUint8(off++, 1)
  buf.setUint8(off++, 1)
  buf.setUint8(off++, 1)
  buf.setUint8(off++, 1)
  buf.setUint32(off, 6, true)

  return new Uint8Array(ab)
}

describe('Dat — constructor', () => {
  it('throws UnsupportedVersionError for unsupported version', () => {
    expect(() => Dat(999)).toThrow(UnsupportedVersionError)
  })

  it('exposes version when explicit', () => {
    expect(Dat(772).version).toBe(772)
  })

  it('version is undefined when not provided', () => {
    expect(Dat().version).toBeUndefined()
  })
})

describe('Dat — validate()', () => {
  it('does not throw when signature matches explicit version', () => {
    const dat = Dat(772)
    expect(() => dat.validate(buildMinimalDat772())).not.toThrow()
  })

  it('throws ParseError when signature does not match explicit version', () => {
    const dat = Dat(772)
    expect(() => dat.validate(new Uint8Array(4))).toThrow(ParseError) // zeros = wrong sig
  })

  it('error message includes version and signature values', () => {
    const dat = Dat(772)
    expect(() => dat.validate(new Uint8Array(4))).toThrowError('772')
  })

  it('auto-detect mode accepts buffer with any known signature', () => {
    const dat = Dat()
    expect(() => dat.validate(buildMinimalDat772())).not.toThrow()
  })

  it('auto-detect mode throws ParseError for unknown signature', () => {
    const dat = Dat()
    expect(() => dat.validate(new Uint8Array(4))).toThrow(ParseError) // all zeros = unknown
  })
})

describe('Dat — load()', () => {
  it('returns a DatFile with version and signature', () => {
    const file = Dat(772).load(buildMinimalDat772())
    expect(file.version).toBe(772)
    expect(file.signature).toBe(DAT_SIGNATURES[772])
  })

  it('returns correct counts from header', () => {
    const file = Dat(772).load(buildMinimalDat772())
    expect(file.counts.itemsMaxCid).toBe(100)
    expect(file.counts.creatures).toBe(0)
    expect(file.counts.effects).toBe(0)
    expect(file.counts.missiles).toBe(0)
  })

  it('get(items, 100) returns the parsed item', () => {
    const file = Dat(772).load(buildMinimalDat772())
    const thing = file.get('items', 100)
    expect(thing).toBeDefined()
    expect(thing?.cid).toBe(100)
    expect(thing?.group).toBe('items')
  })

  it('get() returns undefined for out-of-range cid', () => {
    const file = Dat(772).load(buildMinimalDat772())
    expect(file.get('items', 999)).toBeUndefined()
  })

  it('parsed item has correct layout', () => {
    const file = Dat(772).load(buildMinimalDat772())
    const layout = file.get('items', 100)?.layout
    expect(layout?.width).toBe(1)
    expect(layout?.height).toBe(1)
    expect(layout?.patternZ).toBe(1)
    expect(layout?.frames).toBe(1)
    expect(layout?.exactSize).toBe(32)
    expect(layout?.realSize).toBe(32)
  })

  it('parsed item has correct spriteIds', () => {
    const file = Dat(772).load(buildMinimalDat772())
    expect(file.get('items', 100)?.spriteIds).toEqual([42])
  })

  it('entries() yields all parsed things', () => {
    const file = Dat(772).load(buildMinimalDat772())
    const entries = [...file.entries()]
    expect(entries).toHaveLength(1)
    expect(entries[0]!.cid).toBe(100)
  })

  it('load() can be called multiple times returning consistent results', () => {
    const dat = Dat(772)
    const buf = buildMinimalDat772()
    const file1 = dat.load(buf)
    const file2 = dat.load(buf)
    expect(file1.counts).toEqual(file2.counts)
    expect(file1.get('items', 100)?.cid).toBe(file2.get('items', 100)?.cid)
  })

  it('Dat() auto-detects version from buffer signature', () => {
    const file = Dat().load(buildMinimalDat772())
    // 760/770/772 share signature 0x439d5a33; auto-detect returns first match
    expect([760, 770, 772]).toContain(file.version)
    expect(file.signature).toBe(DAT_SIGNATURES[772])
  })

  it('Dat(772) throws ParseError when buffer signature does not match version', () => {
    const wrongSig = new Uint8Array(22) // all zeros — wrong signature
    expect(() => Dat(772).load(wrongSig)).toThrow(ParseError)
  })

  it('things array contains all parsed things in CID order', () => {
    const file = Dat(772).load(buildMinimalDat772())
    expect(file.things).toHaveLength(1)
    expect(file.things[0]!.cid).toBe(100)
    expect(file.get('items', 100)).toBe(file.things[0])
  })
})

describe('Dat — MARKET flag (9.6+)', () => {
  it('parses MARKET into full MarketData object', () => {
    const file = Dat(960).load(buildMarketDat960())
    const market = file.get('items', 100)?.flags.market
    expect(market).toBeDefined()
    expect(market).toMatchObject({
      category: 3,
      tradeAs: 100,
      showAs: 200,
      name: 'Gold Coin',
      restrictVocation: 1,
      requiredLevel: 50
    })
  })

  it('MARKET: all six fields are populated', () => {
    const market = Dat(960).load(buildMarketDat960()).get('items', 100)?.flags.market!
    expect(typeof market.category).toBe('number')
    expect(typeof market.tradeAs).toBe('number')
    expect(typeof market.showAs).toBe('number')
    expect(typeof market.name).toBe('string')
    expect(typeof market.restrictVocation).toBe('number')
    expect(typeof market.requiredLevel).toBe('number')
  })
})

describe('Dat — AnimationData (10.30+)', () => {
  it('parses animation when frames > 1 and version has frameDurations', () => {
    const file = Dat(1098).load(buildAnimationDat1098())
    const layout = file.get('items', 100)?.layout
    expect(layout?.animation).toBeDefined()
  })

  it('animation has correct async, loopCount, startPhase', () => {
    const animation = Dat(1098).load(buildAnimationDat1098()).get('items', 100)!.layout.animation!
    expect(animation.async).toBe(true)
    expect(animation.loopCount).toBe(-1)
    expect(animation.startPhase).toBe(-1)
  })

  it('animation phaseDurations has one entry per frame', () => {
    const animation = Dat(1098).load(buildAnimationDat1098()).get('items', 100)!.layout.animation!
    expect(animation.phaseDurations).toHaveLength(2)
    expect(animation.phaseDurations[0]).toEqual({ min: 100, max: 200 })
    expect(animation.phaseDurations[1]).toEqual({ min: 50, max: 150 })
  })

  it('layout with frames=1 has no animation field (version 772)', () => {
    const file = Dat(772).load(buildMinimalDat772())
    expect(file.get('items', 100)?.layout.animation).toBeUndefined()
  })
})

describe('Dat — frameGroups (10.57+)', () => {
  it('creature with 2 groups has frameGroups with length 2', () => {
    const file = Dat(1098).load(buildFrameGroupsDat1098())
    const creature = file.get('creatures', 1)
    expect(creature?.frameGroups).toHaveLength(2)
  })

  it('frameGroups entries have groupType, layout and spriteIds', () => {
    const file = Dat(1098).load(buildFrameGroupsDat1098())
    const fgs = file.get('creatures', 1)!.frameGroups!
    expect(fgs[0]!.groupType).toBe(0)
    expect(fgs[1]!.groupType).toBe(1)
    expect(fgs[0]!.spriteIds).toEqual([5])
    expect(fgs[1]!.spriteIds).toEqual([6])
  })

  it('root layout and spriteIds mirror the last frame group', () => {
    const file = Dat(1098).load(buildFrameGroupsDat1098())
    const creature = file.get('creatures', 1)!
    expect(creature.layout).toBe(creature.frameGroups![1]!.layout)
    expect(creature.spriteIds).toBe(creature.frameGroups![1]!.spriteIds)
  })

  it('item in 1098 has no frameGroups', () => {
    const file = Dat(1098).load(buildAnimationDat1098())
    expect(file.get('items', 100)?.frameGroups).toBeUndefined()
  })
})
