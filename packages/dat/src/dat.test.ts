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
  buf.setUint32(off, 7, true) // spriteId = 7 (u32 - extendedSprites on 960)

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

describe('Dat - constructor', () => {
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

describe('Dat - validate()', () => {
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

describe('Dat - load()', () => {
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
    const wrongSig = new Uint8Array(22) // all zeros - wrong signature
    expect(() => Dat(772).load(wrongSig)).toThrow(ParseError)
  })

  it('things array contains all parsed things in CID order', () => {
    const file = Dat(772).load(buildMinimalDat772())
    expect(file.things).toHaveLength(1)
    expect(file.things[0]!.cid).toBe(100)
    expect(file.get('items', 100)).toBe(file.things[0])
  })
})

describe('Dat - MARKET flag (9.6+)', () => {
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

describe('Dat - AnimationData (10.30+)', () => {
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

describe('Dat - frameGroups (10.57+)', () => {
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

describe('Dat - strict mode', () => {
  // Truncated DAT: valid header but last byte of spriteId is missing.
  // parseThing throws BufferOverflowError when reading the sprite list.
  function buildTruncatedDat772(): Uint8Array {
    const valid = buildMinimalDat772()
    return valid.slice(0, valid.length - 1)
  }

  it('lenient mode (default) skips unparseable thing and returns DatFile without throwing', () => {
    const file = Dat(772).load(buildTruncatedDat772())
    expect(file.things).toHaveLength(0) // item 100 was skipped
  })

  it('strict mode throws when a thing cannot be parsed', () => {
    expect(() => Dat(772, { strict: true }).load(buildTruncatedDat772())).toThrow()
  })
})

// Version 740: no patternZ, no extendedSprites. Layout has 6 fields (no patZ byte).
function buildDat740(): Uint8Array {
  const sig = DAT_SIGNATURES[740]!
  // item 100: end-of-flags + 6-field layout + 1x u16 spriteId = 9 bytes
  const ab = new ArrayBuffer(12 + 9)
  const buf = new DataView(ab)
  buf.setUint32(0, sig, true)
  buf.setUint16(4, 100, true)
  buf.setUint16(6, 0, true)
  buf.setUint16(8, 0, true)
  buf.setUint16(10, 0, true)
  buf.setUint8(12, 0xff) // end-of-flags
  buf.setUint8(13, 1) // width
  buf.setUint8(14, 1) // height
  buf.setUint8(15, 1) // layers
  buf.setUint8(16, 1) // patternX
  buf.setUint8(17, 1) // patternY
  // no patternZ field (feature absent before v755)
  buf.setUint8(18, 1) // frames
  buf.setUint16(19, 42, true)
  return new Uint8Array(ab)
}

// Version 772 with width=2, height=2 item: exercises the realSize branch.
// Sprite count: 2×2×1×1×1×1×1 = 4 sprites × u16 = 8 bytes.
function buildLargeLayoutDat772(): Uint8Array {
  const sig = DAT_SIGNATURES[772]!
  const ab = new ArrayBuffer(12 + 17)
  const buf = new DataView(ab)
  buf.setUint32(0, sig, true)
  buf.setUint16(4, 100, true)
  buf.setUint16(6, 0, true)
  buf.setUint16(8, 0, true)
  buf.setUint16(10, 0, true)
  buf.setUint8(12, 0xff)
  buf.setUint8(13, 2) // width = 2
  buf.setUint8(14, 2) // height = 2
  buf.setUint8(15, 64) // realSize = 64 (present because width > 1)
  buf.setUint8(16, 1) // layers
  buf.setUint8(17, 1) // patternX
  buf.setUint8(18, 1) // patternY
  buf.setUint8(19, 1) // patternZ
  buf.setUint8(20, 1) // frames
  buf.setUint16(21, 10, true)
  buf.setUint16(23, 11, true)
  buf.setUint16(25, 12, true)
  buf.setUint16(27, 13, true)
  return new Uint8Array(ab)
}

// Version 772 with 1 effect and 1 missile, no items or creatures.
// itemsMaxCid=99 makes the items range (100..99) empty.
function buildEffectsAndMissilesDat772(): Uint8Array {
  const sig = DAT_SIGNATURES[772]!
  // effect 1 + missile 1: each is 0xFF + 7-byte layout + u16 = 10 bytes
  const ab = new ArrayBuffer(12 + 10 + 10)
  const buf = new DataView(ab)
  buf.setUint32(0, sig, true)
  buf.setUint16(4, 99, true) // itemsMaxCid=99 → items range 100..99 = empty
  buf.setUint16(6, 0, true)
  buf.setUint16(8, 1, true) // effects = 1
  buf.setUint16(10, 1, true) // missiles = 1
  let off = 12
  for (const spriteId of [55, 66]) {
    buf.setUint8(off++, 0xff)
    for (let i = 0; i < 7; i++) buf.setUint8(off++, 1) // width,height,layers,patX,patY,patZ,frames
    buf.setUint16(off, spriteId, true)
    off += 2
  }
  return new Uint8Array(ab)
}

// DAT v860 with WRITABLE, WRITABLE_ONCE, MINIMAP, LENS_HELP, CLOTH, USABLE flags.
// Exercises the anonymous read lambdas in ADVANCED_RULES and write lambdas in WRITE_PAYLOADS.
function buildFlagsDat860(): Uint8Array {
  const sig = DAT_SIGNATURES[860]!
  const flagMap = getDatFlags(860)
  // 6 flags × (1 byte + 2 byte payload) + 1 end = 19 bytes; layout 7 bytes; sprite u16 = 2 bytes
  const ab = new ArrayBuffer(12 + 19 + 7 + 2)
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
  const flagPayloads: [string, number][] = [
    ['WRITABLE', 100],
    ['WRITABLE_ONCE', 50],
    ['MINIMAP', 0xf00],
    ['LENS_HELP', 5],
    ['CLOTH', 7],
    ['USABLE', 1]
  ]
  for (const [name, payload] of flagPayloads) {
    buf.setUint8(off++, flagMap[name]!)
    buf.setUint16(off, payload, true)
    off += 2
  }
  buf.setUint8(off++, 0xff) // end-of-flags
  for (let i = 0; i < 7; i++) buf.setUint8(off++, 1) // layout: all fields = 1
  buf.setUint16(off, 100, true)
  return new Uint8Array(ab)
}

describe('Dat - flag read/write paths (WRITABLE, MINIMAP, LENS_HELP, CLOTH, USABLE)', () => {
  it('parses WRITABLE flag with length payload', () => {
    expect(Dat(860).load(buildFlagsDat860()).get('items', 100)!.flags.writable).toEqual({
      length: 100
    })
  })

  it('parses WRITABLE_ONCE flag with length payload', () => {
    expect(Dat(860).load(buildFlagsDat860()).get('items', 100)!.flags.writableOnce).toEqual({
      length: 50
    })
  })

  it('parses MINIMAP flag with color payload', () => {
    expect(Dat(860).load(buildFlagsDat860()).get('items', 100)!.flags.minimap).toEqual({
      color: 0xf00
    })
  })

  it('parses LENS_HELP flag with value payload', () => {
    expect(Dat(860).load(buildFlagsDat860()).get('items', 100)!.flags.lensHelp).toEqual({
      value: 5
    })
  })

  it('roundtrip 860: all single-value flags survive write/load', () => {
    const original = Dat(860).load(buildFlagsDat860())
    const roundtrip = Dat(860).load(Dat(860).write(original))
    const flags = roundtrip.get('items', 100)!.flags
    expect(flags.writable).toEqual({ length: 100 })
    expect(flags.writableOnce).toEqual({ length: 50 })
    expect(flags.minimap).toEqual({ color: 0xf00 })
    expect(flags.lensHelp).toEqual({ value: 5 })
    expect(flags.cloth).toEqual({ slot: 7 })
    expect(flags.usable).toEqual({ value: 1 })
  })
})

describe('Dat - effects and missiles', () => {
  it('get("effects", 1) returns the effect thing', () => {
    const file = Dat(772).load(buildEffectsAndMissilesDat772())
    const effect = file.get('effects', 1)
    expect(effect).toBeDefined()
    expect(effect!.cid).toBe(1)
    expect(effect!.group).toBe('effects')
  })

  it('get("missiles", 1) returns the missile thing', () => {
    const file = Dat(772).load(buildEffectsAndMissilesDat772())
    const missile = file.get('missiles', 1)
    expect(missile).toBeDefined()
    expect(missile!.cid).toBe(1)
    expect(missile!.group).toBe('missiles')
  })
})

describe('Dat - large layout (realSize)', () => {
  it('item with width=2 height=2 reads realSize from buffer', () => {
    const layout = Dat(772).load(buildLargeLayoutDat772()).get('items', 100)!.layout
    expect(layout.width).toBe(2)
    expect(layout.height).toBe(2)
    expect(layout.realSize).toBe(64)
  })

  it('spriteIds length equals width × height', () => {
    expect(Dat(772).load(buildLargeLayoutDat772()).get('items', 100)!.spriteIds).toHaveLength(4)
  })
})

describe('Dat - non-patternZ version (v740)', () => {
  it('patternZ defaults to 1 without consuming a buffer byte', () => {
    expect(Dat(740).load(buildDat740()).get('items', 100)!.layout.patternZ).toBe(1)
  })
})

describe('Dat - write()', () => {
  it('throws ParseError when constructor version mismatches data.version', () => {
    const file = Dat(772).load(buildMinimalDat772())
    expect(() => Dat(772).write({ ...file, version: 960 })).toThrow(ParseError)
  })

  it('Dat() uses data.version when no version provided in constructor', () => {
    const file = Dat(772).load(buildMinimalDat772())
    expect(() => Dat().write(file)).not.toThrow()
  })

  it('roundtrip 772: item spriteIds survive write/load', () => {
    const original = Dat(772).load(buildMinimalDat772())
    const roundtrip = Dat(772).load(Dat(772).write(original))
    expect(roundtrip.get('items', 100)!.spriteIds).toEqual([42])
  })

  it('roundtrip 960: MARKET flag survives write/load', () => {
    const original = Dat(960).load(buildMarketDat960())
    const roundtrip = Dat(960).load(Dat(960).write(original))
    expect(roundtrip.get('items', 100)!.flags.market?.name).toBe('Gold Coin')
  })

  it('roundtrip 1098: frame groups survive write/load', () => {
    const original = Dat(1098).load(buildFrameGroupsDat1098())
    const roundtrip = Dat(1098).load(Dat(1098).write(original))
    expect(roundtrip.get('creatures', 1)!.frameGroups).toHaveLength(2)
  })

  it('write() fallback: creature without frameGroups is serialized as a single idle group', () => {
    const file = Dat(1098).load(buildFrameGroupsDat1098())
    const creature = file.get('creatures', 1)!
    // Empty frameGroups triggers the fallback path (uses root layout/spriteIds)
    const roundtrip = Dat(1098).load(
      Dat(1098).write({ ...file, things: [{ ...creature, frameGroups: [] }] })
    )
    expect(roundtrip.get('creatures', 1)!.frameGroups).toHaveLength(1)
    expect(roundtrip.get('creatures', 1)!.frameGroups![0]!.groupType).toBe(0)
  })

  it('write() emits zero animation placeholder when frames > 1 but animation field is absent', () => {
    const file = Dat(1098).load(buildAnimationDat1098())
    const item = file.get('items', 100)!
    const { animation: _animation, ...layoutNoAnim } = item.layout
    const roundtrip = Dat(1098).load(
      Dat(1098).write({ ...file, things: [{ ...item, layout: layoutNoAnim }] })
    )
    const anim = roundtrip.get('items', 100)!.layout.animation!
    expect(anim.async).toBe(false)
    expect(anim.loopCount).toBe(0)
    expect(anim.startPhase).toBe(0)
  })

  it('roundtrip 772: large layout with realSize survives write/load', () => {
    const original = Dat(772).load(buildLargeLayoutDat772())
    const roundtrip = Dat(772).load(Dat(772).write(original))
    const layout = roundtrip.get('items', 100)!.layout
    expect(layout.width).toBe(2)
    expect(layout.realSize).toBe(64)
    expect(roundtrip.get('items', 100)!.spriteIds).toHaveLength(4)
  })

  it('roundtrip 740: non-patternZ version survives write/load', () => {
    const original = Dat(740).load(buildDat740())
    const roundtrip = Dat(740).load(Dat(740).write(original))
    expect(roundtrip.version).toBe(740)
    expect(roundtrip.get('items', 100)!.layout.patternZ).toBe(1)
    expect(roundtrip.get('items', 100)!.spriteIds).toEqual([42])
  })

  it('roundtrip 772: effects and missiles survive write/load', () => {
    const original = Dat(772).load(buildEffectsAndMissilesDat772())
    const roundtrip = Dat(772).load(Dat(772).write(original))
    expect(roundtrip.get('effects', 1)!.cid).toBe(1)
    expect(roundtrip.get('missiles', 1)!.cid).toBe(1)
  })
})
