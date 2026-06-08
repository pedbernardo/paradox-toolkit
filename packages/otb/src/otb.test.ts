import { describe, expect, it } from 'vitest'
import { ParseError } from '@paradox/utils'
import { Otb } from './otb.js'
import { ITEM_GROUP } from './otb-config.js'
import { ITEM_ATTRIBUTE } from './otb-attributes.js'
import type { OtbWriteInput } from './types.js'

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Builds a minimal OTB header for the given schema version.
// Appends itemNodes (each already serialized) and the root END byte.
function buildOtb(
  major: number,
  minor: number,
  build: number,
  ...itemNodes: number[][]
): Uint8Array {
  const escU32 = (v: number) => [v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, (v >> 24) & 0xff]
  const escU16 = (v: number) => [v & 0xff, (v >> 8) & 0xff]
  const padding = new Array(116).fill(0)

  const header = [
    0x00,
    0x00,
    0x00,
    0x00, // 4 null bytes (OTB magic)
    0xfe, // root node START
    0x00, // root group
    ...escU32(0), // root flags (escU32 = 0)
    0x01, // ROOT_NODE_ATTR
    ...escU16(14), // dataLength (discard)
    ...escU32(major),
    ...escU32(minor),
    ...escU32(build),
    ...padding // 116 bytes padding
  ]

  return new Uint8Array([...header, ...itemNodes.flat(), 0xff])
}

// Builds a single item node: [0xFE, group, flagsInt×4, ...attrs, 0xFF]
// flagsInt as 4 raw bytes (values < 0xFD = no escape needed in tests)
function buildItemNode(group: number, flagsInt: number, attrs: number[] = []): number[] {
  const flags = [
    flagsInt & 0xff,
    (flagsInt >> 8) & 0xff,
    (flagsInt >> 16) & 0xff,
    (flagsInt >> 24) & 0xff
  ]
  return [0xfe, group, ...flags, ...attrs, 0xff]
}

// Builds a TLV attribute: [attrId, lenLo, lenHi, ...data]
// length is the number of raw data bytes (no escape sequences in test data)
function buildAttr(attrId: number, data: number[]): number[] {
  return [attrId, data.length & 0xff, (data.length >> 8) & 0xff, ...data]
}

// Builds a u16 as 2 little-endian bytes (no escape)
const u16 = (v: number) => [v & 0xff, (v >> 8) & 0xff]

describe('Otb - validate()', () => {
  it('passes for a valid buffer', () => {
    expect(() => Otb().validate(buildOtb(3, 57, 0))).not.toThrow()
  })

  it('throws ParseError for buffer smaller than 12 bytes', () => {
    expect(() => Otb().validate(new Uint8Array(8))).toThrow(ParseError)
  })

  it('throws ParseError if bytes 0–3 are not 0x00', () => {
    const buf = new Uint8Array(buildOtb(3, 57, 0))
    buf[1] = 0x01
    expect(() => Otb().validate(buf)).toThrow(ParseError)
  })

  it('throws ParseError if byte 4 is not 0xFE', () => {
    const buf = new Uint8Array(buildOtb(3, 57, 0))
    buf[4] = 0x00
    expect(() => Otb().validate(buf)).toThrow(ParseError)
  })
})

describe('Otb - load()', () => {
  it('returns OtbFile with correct schemaVersion', () => {
    expect(Otb().load(buildOtb(3, 57, 0)).schemaVersion).toBe('3.57.0')
  })

  it('throws ParseError for unsupported OTB schema version', () => {
    expect(() => Otb().load(buildOtb(99, 0, 0))).toThrow(ParseError)
  })

  it('version 1 is supported', () => {
    expect(() => Otb().load(buildOtb(1, 0, 0))).not.toThrow()
  })

  it('version 2 is supported', () => {
    expect(() => Otb().load(buildOtb(2, 0, 0))).not.toThrow()
  })
})

describe('OtbFile - count', () => {
  it('is 0 when no item nodes present', () => {
    expect(Otb().load(buildOtb(3, 57, 0)).count).toBe(0)
  })

  it('reflects the number of non-deprecated items parsed', () => {
    const items = [
      buildItemNode(ITEM_GROUP.GROUND, 0),
      buildItemNode(ITEM_GROUP.CONTAINER, 0),
      buildItemNode(ITEM_GROUP.WEAPON, 0)
    ]
    expect(Otb().load(buildOtb(3, 57, 0, ...items)).count).toBe(3)
  })

  it('does not count DEPRECATED items', () => {
    const items = [buildItemNode(ITEM_GROUP.GROUND, 0), buildItemNode(ITEM_GROUP.DEPRECATED, 0)]
    expect(Otb().load(buildOtb(3, 57, 0, ...items)).count).toBe(1)
  })
})

describe('OtbFile - get()', () => {
  it('returns undefined for non-existent sid', () => {
    const file = Otb().load(buildOtb(3, 57, 0))
    expect(file.get(999)).toBeUndefined()
  })

  it('returns OtbItem for a valid sid', () => {
    const item = buildItemNode(ITEM_GROUP.GROUND, 0)
    const file = Otb().load(buildOtb(3, 57, 0, item))
    expect(file.get(100)).toBeDefined()
  })

  it('returned item has correct group', () => {
    const item = buildItemNode(ITEM_GROUP.CONTAINER, 0)
    const file = Otb().load(buildOtb(3, 57, 0, item))
    expect(file.get(100)!.group).toBe(ITEM_GROUP.CONTAINER)
  })
})

describe('OtbFile - entries()', () => {
  it('yields [sid, OtbItem] tuples', () => {
    const item1 = buildItemNode(ITEM_GROUP.GROUND, 0)
    const item2 = buildItemNode(ITEM_GROUP.CONTAINER, 0)
    const file = Otb().load(buildOtb(3, 57, 0, item1, item2))
    const entries = [...file.entries()]
    expect(entries).toHaveLength(2)
    expect(entries[0]![0]).toBe(100)
    expect(entries[1]![0]).toBe(101)
  })

  it('items from entries() are identical to get() results', () => {
    const item = buildItemNode(ITEM_GROUP.GROUND, 0)
    const file = Otb().load(buildOtb(3, 57, 0, item))
    const [, fromEntries] = [...file.entries()][0]!
    expect(file.get(100)).toBe(fromEntries)
  })
})

describe('OtbFile - sid auto-increment', () => {
  it('item with sid=0 in file receives sid=100', () => {
    const item = buildItemNode(ITEM_GROUP.GROUND, 0) // no SERVERID attr → sid stays 0
    const file = Otb().load(buildOtb(3, 57, 0, item))
    expect(file.get(100)!.sid).toBe(100)
  })

  it('second item with sid=0 receives sid=101', () => {
    const item1 = buildItemNode(ITEM_GROUP.GROUND, 0)
    const item2 = buildItemNode(ITEM_GROUP.CONTAINER, 0)
    const file = Otb().load(buildOtb(3, 57, 0, item1, item2))
    expect(file.get(101)!.sid).toBe(101)
  })

  it('item with explicit sid uses that value and updates nextServerId', () => {
    const sidAttr = buildAttr(ITEM_ATTRIBUTE.SERVERID, u16(200))
    const item1 = buildItemNode(ITEM_GROUP.GROUND, 0, sidAttr)
    const item2 = buildItemNode(ITEM_GROUP.CONTAINER, 0) // sid=0 → next after 200 = 201
    const file = Otb().load(buildOtb(3, 57, 0, item1, item2))
    expect(file.get(200)).toBeDefined()
    expect(file.get(201)).toBeDefined()
  })
})

describe('OtbFile - DEPRECATED group', () => {
  it('DEPRECATED item is not returned by get()', () => {
    const item = buildItemNode(ITEM_GROUP.DEPRECATED, 0)
    const file = Otb().load(buildOtb(3, 57, 0, item))
    expect(file.get(100)).toBeUndefined()
    expect(file.count).toBe(0)
  })
})

describe('OtbFile - RUNE group', () => {
  it('RUNE item has clientCharges=true regardless of flags bitmask', () => {
    const item = buildItemNode(ITEM_GROUP.RUNE, 0)
    const file = Otb().load(buildOtb(3, 57, 0, item))
    expect(file.get(100)!.flags.clientCharges).toBe(true)
  })
})

describe('OtbFile - attributes', () => {
  it('parses NAME attribute', () => {
    const nameBytes = Array.from('Sword').map((c) => c.charCodeAt(0))
    const attr = buildAttr(ITEM_ATTRIBUTE.NAME, nameBytes)
    const item = buildItemNode(ITEM_GROUP.WEAPON, 0, attr)
    const file = Otb().load(buildOtb(3, 57, 0, item))
    expect(file.get(100)!.attributes.name).toBe('Sword')
  })

  it('parses SPEED attribute', () => {
    const attr = buildAttr(ITEM_ATTRIBUTE.SPEED, u16(150))
    const item = buildItemNode(ITEM_GROUP.GROUND, 0, attr)
    const file = Otb().load(buildOtb(3, 57, 0, item))
    expect(file.get(100)!.attributes.speed).toBe(150)
  })

  it('parses CLIENT_ID attribute', () => {
    const attr = buildAttr(ITEM_ATTRIBUTE.CLIENT_ID, u16(300))
    const item = buildItemNode(ITEM_GROUP.GROUND, 0, attr)
    const file = Otb().load(buildOtb(3, 57, 0, item))
    expect(file.get(100)!.cid).toBe(300)
  })

  it('parses multiple attributes in one item', () => {
    const nameAttr = buildAttr(
      ITEM_ATTRIBUTE.NAME,
      Array.from('Axe').map((c) => c.charCodeAt(0))
    )
    const speedAttr = buildAttr(ITEM_ATTRIBUTE.SPEED, u16(80))
    const item = buildItemNode(ITEM_GROUP.WEAPON, 0, [...nameAttr, ...speedAttr])
    const file = Otb().load(buildOtb(3, 57, 0, item))
    const loaded = file.get(100)!
    expect(loaded.attributes.name).toBe('Axe')
    expect(loaded.attributes.speed).toBe(80)
  })

  it('handles escape sequence in attribute data - sid 0xFE (254)', () => {
    // sid 254 = 0xFE → stored escaped as [0xFD, 0xFE] in the attr payload
    // attr: [id=16, len=2, lenHi=0, 0xFD, 0xFE, 0x00]
    const escAttr = [ITEM_ATTRIBUTE.SERVERID, 0x02, 0x00, 0xfd, 0xfe, 0x00]
    const item = buildItemNode(ITEM_GROUP.GROUND, 0, escAttr)
    const file = Otb().load(buildOtb(3, 57, 0, item))
    expect(file.get(254)).toBeDefined()
    expect(file.get(254)!.sid).toBe(254)
  })

  it('parses DESCRIPTION attribute', () => {
    const bytes = Array.from('a sword').map((c) => c.charCodeAt(0))
    const attr = buildAttr(ITEM_ATTRIBUTE.DESCRIPTION, bytes)
    const item = buildItemNode(ITEM_GROUP.WEAPON, 0, attr)
    const file = Otb().load(buildOtb(3, 57, 0, item))
    expect(file.get(100)!.attributes.description).toBe('a sword')
  })

  it('parses SPRITEHASH attribute', () => {
    const hashBytes = new Array(16).fill(0x42)
    const attr = buildAttr(ITEM_ATTRIBUTE.SPRITEHASH, hashBytes)
    const item = buildItemNode(ITEM_GROUP.GROUND, 0, attr)
    const file = Otb().load(buildOtb(3, 57, 0, item))
    expect(file.get(100)!.attributes.spriteHash).toHaveLength(16)
  })

  it('parses MINIMAPCOLOR attribute', () => {
    const attr = buildAttr(ITEM_ATTRIBUTE.MINIMAPCOLOR, u16(210))
    const item = buildItemNode(ITEM_GROUP.GROUND, 0, attr)
    const file = Otb().load(buildOtb(3, 57, 0, item))
    expect(file.get(100)!.attributes.minimapColor).toBe(210)
  })

  it('parses MAXITEMS attribute', () => {
    const attr = buildAttr(ITEM_ATTRIBUTE.MAXITEMS, u16(20))
    const item = buildItemNode(ITEM_GROUP.CONTAINER, 0, attr)
    const file = Otb().load(buildOtb(3, 57, 0, item))
    expect(file.get(100)!.attributes.maxItems).toBe(20)
  })

  it('parses WEIGHT attribute', () => {
    const weightBytes = [0x64, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00] // 100 as u64 LE
    const attr = buildAttr(ITEM_ATTRIBUTE.WEIGHT, weightBytes)
    const item = buildItemNode(ITEM_GROUP.WEAPON, 0, attr)
    const file = Otb().load(buildOtb(3, 57, 0, item))
    expect(file.get(100)!.attributes.weight).toBe(100)
  })

  it('parses TOPORDER attribute', () => {
    const attr = buildAttr(ITEM_ATTRIBUTE.TOPORDER, [2])
    const item = buildItemNode(ITEM_GROUP.GROUND, 0, attr)
    const file = Otb().load(buildOtb(3, 57, 0, item))
    expect(file.get(100)!.attributes.alwaysOnTopOrder).toBe(2)
  })

  it('parses ROTATETO attribute', () => {
    const attr = buildAttr(ITEM_ATTRIBUTE.ROTATETO, u16(102))
    const item = buildItemNode(ITEM_GROUP.GROUND, 0, attr)
    const file = Otb().load(buildOtb(3, 57, 0, item))
    expect(file.get(100)!.attributes.rotateTo).toBe(102)
  })

  it('parses MAX_WRITE_LENGTH attribute', () => {
    const attr = buildAttr(ITEM_ATTRIBUTE.MAX_WRITE_LENGTH, u16(200))
    const item = buildItemNode(ITEM_GROUP.WEAPON, 0, attr)
    const file = Otb().load(buildOtb(3, 57, 0, item))
    expect(file.get(100)!.attributes.maxWriteLength).toBe(200)
  })

  it('parses MAX_READ_LENGTH attribute', () => {
    const attr = buildAttr(ITEM_ATTRIBUTE.MAX_READ_LENGTH, u16(512))
    const item = buildItemNode(ITEM_GROUP.WEAPON, 0, attr)
    const file = Otb().load(buildOtb(3, 57, 0, item))
    expect(file.get(100)!.attributes.maxReadLength).toBe(512)
  })

  it('parses LIGHT attribute', () => {
    const attr = buildAttr(ITEM_ATTRIBUTE.LIGHT, [...u16(5), ...u16(0xe0)])
    const item = buildItemNode(ITEM_GROUP.GROUND, 0, attr)
    const file = Otb().load(buildOtb(3, 57, 0, item))
    expect(file.get(100)!.attributes.lightLevel).toBe(5)
    expect(file.get(100)!.attributes.lightColor).toBe(0xe0)
  })

  it('parses LIGHT2 attribute', () => {
    const attr = buildAttr(ITEM_ATTRIBUTE.LIGHT2, [...u16(8), ...u16(0xd7)])
    const item = buildItemNode(ITEM_GROUP.GROUND, 0, attr)
    const file = Otb().load(buildOtb(3, 57, 0, item))
    expect(file.get(100)!.attributes.lightLevel).toBe(8)
    expect(file.get(100)!.attributes.lightColor).toBe(0xd7)
  })

  it('skips unknown attribute IDs via reader.skip()', () => {
    const unknownAttr = buildAttr(0x99, [0x01, 0x02, 0x03])
    const nameBytes = Array.from('Sword').map((c) => c.charCodeAt(0))
    const nameAttr = buildAttr(ITEM_ATTRIBUTE.NAME, nameBytes)
    const item = buildItemNode(ITEM_GROUP.WEAPON, 0, [...unknownAttr, ...nameAttr])
    const file = Otb().load(buildOtb(3, 57, 0, item))
    expect(file.get(100)!.attributes.name).toBe('Sword')
  })

  it('parses WAREID attribute', () => {
    const attr = buildAttr(ITEM_ATTRIBUTE.WAREID, u16(1234))
    const item = buildItemNode(ITEM_GROUP.GROUND, 0, attr)
    const file = Otb().load(buildOtb(3, 57, 0, item))
    expect(file.get(100)!.attributes.wareId).toBe(1234)
  })

  it('parses CLASSIFICATION attribute', () => {
    const attr = buildAttr(ITEM_ATTRIBUTE.CLASSIFICATION, [3])
    const item = buildItemNode(ITEM_GROUP.GROUND, 0, attr)
    const file = Otb().load(buildOtb(3, 57, 0, item))
    expect(file.get(100)!.attributes.classification).toBe(3)
  })
})

describe('OtbFile - items', () => {
  it('is an empty array when no items are present', () => {
    expect(Otb().load(buildOtb(3, 57, 0)).items).toHaveLength(0)
  })

  it('length equals count', () => {
    const nodes = [
      buildItemNode(ITEM_GROUP.GROUND, 0),
      buildItemNode(ITEM_GROUP.CONTAINER, 0),
      buildItemNode(ITEM_GROUP.WEAPON, 0)
    ]
    const file = Otb().load(buildOtb(3, 57, 0, ...nodes))
    expect(file.items).toHaveLength(file.count)
  })

  it('items in array are identical objects to get() results', () => {
    const node = buildItemNode(ITEM_GROUP.GROUND, 0)
    const file = Otb().load(buildOtb(3, 57, 0, node))
    expect(file.items[0]).toBe(file.get(100))
  })

  it('satisfies OtbWriteInput structural subtyping', () => {
    const file = Otb().load(buildOtb(3, 57, 0))
    const _: OtbWriteInput = file
    expect(_).toBeDefined()
  })
})
