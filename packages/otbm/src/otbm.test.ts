import { describe, expect, it, vi } from 'vitest'
import { ParseError } from '@paradox/utils'
import type { OtbLookup, OtbmWriteInput } from './types.js'
import { Otbm } from './otbm.js'
import { decodeTileFlags } from './otbm-attributes.js'
import { OTBM_ATTRIBUTE, OTBM_NODE_TYPE, OTBM_TILE_FLAG } from './otbm-config.js'

// ─── Buffer builder ───────────────────────────────────────────────────────────

// Encodes a value as little-endian bytes (no escape sequences — test data avoids 0xFD/FE/FF)
const u8 = (v: number) => [v & 0xff]
const u16 = (v: number) => [v & 0xff, (v >> 8) & 0xff]
const u32 = (v: number) => [v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, (v >> 24) & 0xff]
const str = (s: string) => [...u16(s.length), ...Array.from(s).map((c) => c.charCodeAt(0))]

// Wraps bytes as an OTBM node: 0xFE type ...props ...children 0xFF
function node(type: number, props: number[], ...children: number[][]): number[] {
  return [0xfe, type, ...props, ...children.flat(), 0xff]
}

type TileSpec = {
  offsetX: number
  offsetY: number
  kind?: 'tile' | 'house'
  houseId?: number
  flags?: number // bitmask
  tileAttrs?: number[] // raw tile attr bytes appended after flags/inlineItems
  inlineItems?: number[] // sids for ITEM(0x09) inline attrs
  items?: ItemSpec[] // child ITEM nodes
}

type ItemSpec = {
  sid: number
  attrs?: number[] // raw attr bytes
  children?: ItemSpec[]
}

function buildItemNode(spec: ItemSpec): number[] {
  const children = (spec.children ?? []).map(buildItemNode)
  return node(OTBM_NODE_TYPE.ITEM, [...u16(spec.sid), ...(spec.attrs ?? [])], ...children)
}

function buildTileNode(spec: TileSpec): number[] {
  const props: number[] = [...u8(spec.offsetX), ...u8(spec.offsetY)]

  if (spec.kind === 'house') {
    props.push(...u32(spec.houseId ?? 1))
  }

  if (spec.flags !== undefined) {
    props.push(OTBM_ATTRIBUTE.TILE_FLAGS, ...u32(spec.flags))
  }

  for (const sid of spec.inlineItems ?? []) {
    props.push(OTBM_ATTRIBUTE.ITEM, ...u16(sid))
  }

  if (spec.tileAttrs !== undefined) {
    props.push(...spec.tileAttrs)
  }

  const type = spec.kind === 'house' ? OTBM_NODE_TYPE.HOUSETILE : OTBM_NODE_TYPE.TILE
  const itemNodes = (spec.items ?? []).map(buildItemNode)
  return node(type, props, ...itemNodes)
}

type TownSpec = { id: number; name: string; x: number; y: number; z: number }
type WaypointSpec = { name: string; x: number; y: number; z: number }

type OtbmBufferOpts = {
  version?: number
  width?: number
  height?: number
  majorVersion?: number
  minorVersion?: number
  areas?: Array<{
    baseX: number
    baseY: number
    baseZ: number
    tiles: TileSpec[]
  }>
  towns?: TownSpec[]
  waypoints?: WaypointSpec[]
}

function buildOtbmBuffer(opts: OtbmBufferOpts = {}): Uint8Array {
  const {
    version = 1,
    width = 1000,
    height = 1000,
    majorVersion = 3,
    minorVersion = 57,
    areas = [],
    towns = [],
    waypoints = []
  } = opts

  // Root node props: version u32, width u16, height u16, majorVersion u32, minorVersion u32
  const rootProps = [
    ...u32(version),
    ...u16(width),
    ...u16(height),
    ...u32(majorVersion),
    ...u32(minorVersion)
  ]

  const areaNodes = areas.map(({ baseX, baseY, baseZ, tiles }) => {
    const areaProps = [...u16(baseX), ...u16(baseY), ...u8(baseZ)]
    const tileNodes = tiles.map(buildTileNode)
    return node(OTBM_NODE_TYPE.TILE_AREA, areaProps, ...tileNodes)
  })

  const townNodes = towns.map((t) =>
    node(OTBM_NODE_TYPE.TOWN, [...u32(t.id), ...str(t.name), ...u16(t.x), ...u16(t.y), ...u8(t.z)])
  )
  const townsNode: number[][] =
    townNodes.length > 0 ? [node(OTBM_NODE_TYPE.TOWNS, [], ...townNodes)] : []

  const waypointNodes = waypoints.map((w) =>
    node(OTBM_NODE_TYPE.WAYPOINT, [...str(w.name), ...u16(w.x), ...u16(w.y), ...u8(w.z)])
  )
  const waypointsNode: number[][] =
    waypointNodes.length > 0 ? [node(OTBM_NODE_TYPE.WAYPOINTS, [], ...waypointNodes)] : []

  const mapDataProps: number[] = []
  const mapDataNode = node(
    OTBM_NODE_TYPE.MAP_DATA,
    mapDataProps,
    ...areaNodes,
    ...townsNode,
    ...waypointsNode
  )

  const rootNode = node(OTBM_NODE_TYPE.WORLD_NODE, rootProps, mapDataNode)

  const magic = [0x00, 0x00, 0x00, 0x00]
  return new Uint8Array([...magic, ...rootNode])
}

// ─── validate() ──────────────────────────────────────────────────────────────

describe('Otbm — validate()', () => {
  it.each([0, 1, 2, 3])('passes for version %i in magic bytes', (v) => {
    const buf = buildOtbmBuffer()
    const view = new DataView(buf.buffer)
    view.setUint32(0, v, true) // overwrite magic with version value
    expect(() => Otbm().validate(buf)).not.toThrow()
  })

  it('throws ParseError for magic > 3 (e.g. 99)', () => {
    const buf = buildOtbmBuffer()
    const view = new DataView(buf.buffer)
    view.setUint32(0, 99, true)
    expect(() => Otbm().validate(buf)).toThrow(ParseError)
  })

  it('throws ParseError for buffer smaller than 6 bytes', () => {
    expect(() => Otbm().validate(new Uint8Array(5))).toThrow(ParseError)
  })

  it('throws ParseError if byte 4 is not 0xFE', () => {
    const buf = buildOtbmBuffer()
    buf[4] = 0x00
    expect(() => Otbm().validate(buf)).toThrow(ParseError)
  })
})

// ─── load() — header ─────────────────────────────────────────────────────────

describe('Otbm — load() header', () => {
  it('parses version, width, height, majorVersion, minorVersion from v1 buffer', () => {
    const file = Otbm().load(
      buildOtbmBuffer({ version: 1, width: 2000, height: 1500, majorVersion: 3, minorVersion: 57 })
    )
    expect(file.header.version).toBe(1)
    expect(file.header.width).toBe(2000)
    expect(file.header.height).toBe(1500)
    expect(file.header.majorVersion).toBe(3)
    expect(file.header.minorVersion).toBe(57)
  })
})

// ─── load() — v0 ─────────────────────────────────────────────────────────────

describe('Otbm — load() v0', () => {
  it('throws ParseError for version 0 without OtbLookup', () => {
    expect(() => Otbm().load(buildOtbmBuffer({ version: 0 }))).toThrow(ParseError)
  })

  it('returns OtbmFile for version 0 with OtbLookup provided', () => {
    const lookup = { getBySid: () => ({ cid: 1 }) }
    const file = Otbm({ lookup }).load(buildOtbmBuffer({ version: 0 }))
    expect(file).toBeDefined()
    expect(file.header.version).toBe(0)
  })
})

// ─── areas / getTile() ───────────────────────────────────────────────────────

describe('Otbm — tile parsing', () => {
  it('regular tile has kind=tile and correct pos from baseX+offsetX', () => {
    const buf = buildOtbmBuffer({
      areas: [
        { baseX: 100, baseY: 200, baseZ: 7, tiles: [{ offsetX: 3, offsetY: 5, kind: 'tile' }] }
      ]
    })
    const tile = Otbm().load(buf).getTile(103, 205, 7)!
    expect(tile.kind).toBe('tile')
    expect(tile.x).toBe(103)
    expect(tile.y).toBe(205)
    expect(tile.z).toBe(7)
  })

  it('house tile has kind=house and correct houseId', () => {
    const buf = buildOtbmBuffer({
      areas: [
        {
          baseX: 500,
          baseY: 400,
          baseZ: 8,
          tiles: [{ offsetX: 1, offsetY: 2, kind: 'house', houseId: 42 }]
        }
      ]
    })
    const tile = Otbm().load(buf).getTile(501, 402, 8)!
    expect(tile.kind).toBe('house')
    if (tile.kind === 'house') expect(tile.houseId).toBe(42)
  })

  it('tile with TILE_FLAGS sets protectionZone=true when bit 0 is set', () => {
    const buf = buildOtbmBuffer({
      areas: [{ baseX: 0, baseY: 0, baseZ: 7, tiles: [{ offsetX: 0, offsetY: 0, flags: 0x01 }] }]
    })
    const tile = Otbm().load(buf).getTile(0, 0, 7)!
    expect(!!(tile.flags & 0x01)).toBe(true) // PROTECTION_ZONE
    expect(!!(tile.flags & 0x04)).toBe(false) // NO_PVP
  })

  it('getTile returns undefined for non-existent coordinates', () => {
    const buf = buildOtbmBuffer({
      areas: [{ baseX: 0, baseY: 0, baseZ: 7, tiles: [{ offsetX: 0, offsetY: 0 }] }]
    })
    expect(Otbm().load(buf).getTile(999, 999, 7)).toBeUndefined()
  })
})

// ─── items ────────────────────────────────────────────────────────────────────

describe('Otbm — item parsing', () => {
  it('inline ITEM attr (0x09) creates item in tile.items', () => {
    const buf = buildOtbmBuffer({
      areas: [
        { baseX: 0, baseY: 0, baseZ: 7, tiles: [{ offsetX: 0, offsetY: 0, inlineItems: [100] }] }
      ]
    })
    const tile = Otbm().load(buf).getTile(0, 0, 7)!
    expect(tile.items).toHaveLength(1)
    expect(tile.items[0]!.sid).toBe(100)
  })

  it('child ITEM node creates item in tile.items', () => {
    const buf = buildOtbmBuffer({
      areas: [
        {
          baseX: 0,
          baseY: 0,
          baseZ: 7,
          tiles: [{ offsetX: 0, offsetY: 0, items: [{ sid: 200 }] }]
        }
      ]
    })
    const tile = Otbm().load(buf).getTile(0, 0, 7)!
    expect(tile.items).toHaveLength(1)
    expect(tile.items[0]!.sid).toBe(200)
  })

  it('COUNT attr sets item.count', () => {
    const attrs = [OTBM_ATTRIBUTE.COUNT, 5]
    const buf = buildOtbmBuffer({
      areas: [
        {
          baseX: 0,
          baseY: 0,
          baseZ: 7,
          tiles: [{ offsetX: 0, offsetY: 0, items: [{ sid: 150, attrs }] }]
        }
      ]
    })
    const tile = Otbm().load(buf).getTile(0, 0, 7)!
    expect(tile.items[0]!.count).toBe(5)
  })

  it('ACTION_ID and UNIQUE_ID attrs are parsed correctly', () => {
    const attrs = [OTBM_ATTRIBUTE.ACTION_ID, 0x64, 0x00, OTBM_ATTRIBUTE.UNIQUE_ID, 0x0a, 0x00]
    const buf = buildOtbmBuffer({
      areas: [
        {
          baseX: 0,
          baseY: 0,
          baseZ: 7,
          tiles: [{ offsetX: 0, offsetY: 0, items: [{ sid: 100, attrs }] }]
        }
      ]
    })
    const item = Otbm().load(buf).getTile(0, 0, 7)!.items[0]!
    expect(item.actionId).toBe(100)
    expect(item.uniqueId).toBe(10)
  })

  it('TELE_DEST attr sets destX, destY, destZ', () => {
    const attrs = [OTBM_ATTRIBUTE.TELE_DEST, ...u16(300), ...u16(400), 7]
    const buf = buildOtbmBuffer({
      areas: [
        {
          baseX: 0,
          baseY: 0,
          baseZ: 7,
          tiles: [{ offsetX: 0, offsetY: 0, items: [{ sid: 1, attrs }] }]
        }
      ]
    })
    const item = Otbm().load(buf).getTile(0, 0, 7)!.items[0]!
    expect(item.destX).toBe(300)
    expect(item.destY).toBe(400)
    expect(item.destZ).toBe(7)
  })

  it('nested item (container) has children array with correct sid', () => {
    const containerItem: ItemSpec = { sid: 10, children: [{ sid: 55 }] }
    const buf = buildOtbmBuffer({
      areas: [
        {
          baseX: 0,
          baseY: 0,
          baseZ: 7,
          tiles: [{ offsetX: 0, offsetY: 0, items: [containerItem] }]
        }
      ]
    })
    const tile = Otbm().load(buf).getTile(0, 0, 7)!
    expect(tile.items[0]!.children).toHaveLength(1)
    expect(tile.items[0]!.children![0]!.sid).toBe(55)
  })
})

// ─── written / charges / sleep attributes ────────────────────────────────────

describe('Otbm — written, charges, sleep attributes', () => {
  it('WRITTEN_DATE (0x12) reads u32 into item.writtenDate', () => {
    const attrs = [OTBM_ATTRIBUTE.WRITTEN_DATE, ...u32(1716681600)]
    const buf = buildOtbmBuffer({
      areas: [
        {
          baseX: 0,
          baseY: 0,
          baseZ: 7,
          tiles: [{ offsetX: 0, offsetY: 0, items: [{ sid: 1, attrs }] }]
        }
      ]
    })
    expect(Otbm().load(buf).getTile(0, 0, 7)!.items[0]!.writtenDate).toBe(1716681600)
  })

  it('WRITTEN_BY (0x13) reads string into item.writtenBy', () => {
    const attrs = [OTBM_ATTRIBUTE.WRITTEN_BY, ...str('Tibia')]
    const buf = buildOtbmBuffer({
      areas: [
        {
          baseX: 0,
          baseY: 0,
          baseZ: 7,
          tiles: [{ offsetX: 0, offsetY: 0, items: [{ sid: 1, attrs }] }]
        }
      ]
    })
    expect(Otbm().load(buf).getTile(0, 0, 7)!.items[0]!.writtenBy).toBe('Tibia')
  })

  it('CHARGES (0x16) reads u16 into item.charges', () => {
    const attrs = [OTBM_ATTRIBUTE.CHARGES, ...u16(500)]
    const buf = buildOtbmBuffer({
      areas: [
        {
          baseX: 0,
          baseY: 0,
          baseZ: 7,
          tiles: [{ offsetX: 0, offsetY: 0, items: [{ sid: 1, attrs }] }]
        }
      ]
    })
    expect(Otbm().load(buf).getTile(0, 0, 7)!.items[0]!.charges).toBe(500)
  })

  it('SLEEPER_GUID (0x14) is silently skipped, item parses cleanly', () => {
    const attrs = [OTBM_ATTRIBUTE.SLEEPER_GUID, ...u32(12345), OTBM_ATTRIBUTE.COUNT, 3]
    const buf = buildOtbmBuffer({
      areas: [
        {
          baseX: 0,
          baseY: 0,
          baseZ: 7,
          tiles: [{ offsetX: 0, offsetY: 0, items: [{ sid: 1, attrs }] }]
        }
      ]
    })
    const item = Otbm().load(buf).getTile(0, 0, 7)!.items[0]!
    expect(item.count).toBe(3)
  })

  it('SLEEP_START (0x15) is silently skipped, item parses cleanly', () => {
    const attrs = [OTBM_ATTRIBUTE.SLEEP_START, ...u32(9999999), OTBM_ATTRIBUTE.COUNT, 7]
    const buf = buildOtbmBuffer({
      areas: [
        {
          baseX: 0,
          baseY: 0,
          baseZ: 7,
          tiles: [{ offsetX: 0, offsetY: 0, items: [{ sid: 1, attrs }] }]
        }
      ]
    })
    const item = Otbm().load(buf).getTile(0, 0, 7)!.items[0]!
    expect(item.count).toBe(7)
  })

  it('ATTRIBUTE_MAP (0x80) does not throw in strict mode and item parses cleanly', () => {
    const attrs = [
      OTBM_ATTRIBUTE.ACTION_ID,
      ...u16(42),
      OTBM_ATTRIBUTE.ATTRIBUTE_MAP,
      0x03,
      0x00,
      0x00
    ]
    const buf = buildOtbmBuffer({
      version: 1,
      areas: [
        {
          baseX: 0,
          baseY: 0,
          baseZ: 7,
          tiles: [{ offsetX: 0, offsetY: 0, items: [{ sid: 1, attrs }] }]
        }
      ]
    })
    const item = Otbm().load(buf).getTile(0, 0, 7)!.items[0]!
    expect(item.actionId).toBe(42)
  })
})

// ─── unknown attributes ───────────────────────────────────────────────────────

describe('Otbm — unknown attributes', () => {
  it('throws ParseError for unknown item attribute in v1+', () => {
    const attrs = [0x7f, 0x01, 0x02] // 0x7F is not a known attribute
    const buf = buildOtbmBuffer({
      version: 1,
      areas: [
        {
          baseX: 0,
          baseY: 0,
          baseZ: 7,
          tiles: [{ offsetX: 0, offsetY: 0, items: [{ sid: 1, attrs }] }]
        }
      ]
    })
    expect(() => Otbm().load(buf)).toThrow(ParseError)
  })
})

// ─── towns ────────────────────────────────────────────────────────────────────

describe('Otbm — towns', () => {
  it('returns towns with id, name and pos', () => {
    const buf = buildOtbmBuffer({
      towns: [{ id: 1, name: 'Capital', x: 100, y: 200, z: 7 }]
    })
    const towns = Otbm().load(buf).towns
    expect(towns).toHaveLength(1)
    expect(towns[0]!.id).toBe(1)
    expect(towns[0]!.name).toBe('Capital')
    expect(towns[0]!.x).toBe(100)
    expect(towns[0]!.y).toBe(200)
    expect(towns[0]!.z).toBe(7)
  })
})

// ─── waypoints ────────────────────────────────────────────────────────────────

describe('Otbm — waypoints', () => {
  it('returns empty array for version 1 (no waypoints section)', () => {
    const buf = buildOtbmBuffer({
      version: 1,
      waypoints: [{ name: 'Spawn', x: 50, y: 60, z: 7 }]
    })
    expect(Otbm().load(buf).waypoints).toHaveLength(0)
  })

  it('returns waypoints for version 2+', () => {
    const buf = buildOtbmBuffer({
      version: 2,
      waypoints: [{ name: 'Spawn', x: 50, y: 60, z: 7 }]
    })
    const wps = Otbm().load(buf).waypoints
    expect(wps).toHaveLength(1)
    expect(wps[0]!.name).toBe('Spawn')
    expect(wps[0]!.x).toBe(50)
    expect(wps[0]!.y).toBe(60)
    expect(wps[0]!.z).toBe(7)
  })
})

// ─── onProgress ──────────────────────────────────────────────────────────────

describe('Otbm — onProgress', () => {
  it('is called once per tile area, last value is 1', () => {
    const calls: number[] = []
    const buf = buildOtbmBuffer({
      areas: [
        { baseX: 0, baseY: 0, baseZ: 7, tiles: [{ offsetX: 0, offsetY: 0 }] },
        { baseX: 100, baseY: 0, baseZ: 7, tiles: [{ offsetX: 0, offsetY: 0 }] },
        { baseX: 200, baseY: 0, baseZ: 7, tiles: [{ offsetX: 0, offsetY: 0 }] }
      ]
    })
    Otbm().load(buf, { onProgress: (p) => calls.push(p) })
    expect(calls).toHaveLength(3)
    expect(calls[calls.length - 1]).toBe(1)
    for (const p of calls) {
      expect(p).toBeGreaterThan(0)
      expect(p).toBeLessThanOrEqual(1)
    }
  })

  it('is not called when there are no tile areas', () => {
    const calls: number[] = []
    Otbm().load(buildOtbmBuffer({ areas: [] }), { onProgress: (p) => calls.push(p) })
    expect(calls).toHaveLength(0)
  })

  it('values are strictly increasing', () => {
    const calls: number[] = []
    const buf = buildOtbmBuffer({
      areas: [
        { baseX: 0, baseY: 0, baseZ: 7, tiles: [{ offsetX: 0, offsetY: 0 }] },
        { baseX: 100, baseY: 0, baseZ: 7, tiles: [{ offsetX: 0, offsetY: 0 }] },
        { baseX: 200, baseY: 0, baseZ: 7, tiles: [{ offsetX: 0, offsetY: 0 }] }
      ]
    })
    Otbm().load(buf, { onProgress: (p) => calls.push(p) })
    for (let i = 1; i < calls.length; i++) {
      expect(calls[i]).toBeGreaterThan(calls[i - 1]!)
    }
  })
})

// ─── getStats() ───────────────────────────────────────────────────────────────

describe('Otbm — getStats()', () => {
  it('counts areas, tiles, houseTiles, items, nestedItems, towns, waypoints correctly', () => {
    const buf = buildOtbmBuffer({
      version: 2,
      areas: [
        {
          baseX: 0,
          baseY: 0,
          baseZ: 7,
          tiles: [
            // tile 1: regular, 1 inline item + 1 child item
            { offsetX: 0, offsetY: 0, inlineItems: [10], items: [{ sid: 20 }] },
            // tile 2: house tile, 1 child item that has 1 nested child
            {
              offsetX: 1,
              offsetY: 0,
              kind: 'house',
              houseId: 5,
              items: [{ sid: 30, children: [{ sid: 40 }] }]
            }
          ]
        }
      ],
      towns: [{ id: 1, name: 'Town', x: 0, y: 0, z: 7 }]
    })
    const stats = Otbm().load(buf).getStats()
    expect(stats.areas).toBe(1)
    expect(stats.tiles).toBe(2)
    expect(stats.houseTiles).toBe(1)
    expect(stats.items).toBe(3) // tile1: inline(10) + child(20) = 2; tile2: child(30) = 1
    expect(stats.nestedItems).toBe(1) // item 40 is nested inside 30
    expect(stats.towns).toBe(1)
    expect(stats.waypoints).toBe(0)
  })
})

// ─── OtbmWriteInput structural subtyping ─────────────────────────────────────

describe('Otbm — OtbmWriteInput structural subtyping', () => {
  it('OtbmFile satisfies OtbmWriteInput without cast', () => {
    const file = Otbm().load(buildOtbmBuffer())
    // type-level assertion: if this compiles, OtbmFile structurally satisfies OtbmWriteInput
    const _: OtbmWriteInput = file
    expect(_).toBeDefined()
  })

  it('areas is a mutable array (push compiles and works at runtime)', () => {
    const file = Otbm().load(
      buildOtbmBuffer({
        areas: [{ baseX: 0, baseY: 0, baseZ: 7, tiles: [{ offsetX: 0, offsetY: 0 }] }]
      })
    )
    const before = file.areas.length
    file.areas.push({ baseX: 100, baseY: 100, baseZ: 0, tiles: [] })
    expect(file.areas.length).toBe(before + 1)
  })
})

// ─── getTile contract after mutation ─────────────────────────────────────────

describe('Otbm — getTile contract after mutation', () => {
  it('tile added to areas[0].tiles after load is NOT found by getTile (snapshot contract)', () => {
    const buf = buildOtbmBuffer({
      areas: [{ baseX: 0, baseY: 0, baseZ: 7, tiles: [{ offsetX: 0, offsetY: 0 }] }]
    })
    const file = Otbm().load(buf)
    file.areas[0]!.tiles.push({ kind: 'tile', x: 50, y: 50, z: 7, flags: 0, items: [] })
    expect(file.getTile(50, 50, 7)).toBeUndefined()
  })

  it('field mutation on existing tile IS visible via getTile (shared reference)', () => {
    const buf = buildOtbmBuffer({
      areas: [{ baseX: 0, baseY: 0, baseZ: 7, tiles: [{ offsetX: 0, offsetY: 0, flags: 0x00 }] }]
    })
    const file = Otbm().load(buf)
    const tile = file.getTile(0, 0, 7)!
    tile.flags = 0x01
    expect(file.getTile(0, 0, 7)!.flags).toBe(0x01)
  })
})

// ─── ArrayBuffer input ────────────────────────────────────────────────────────

describe('Otbm — ArrayBuffer input', () => {
  it('accepts ArrayBuffer in addition to Uint8Array', () => {
    const uint8 = buildOtbmBuffer()
    const ab = uint8.buffer.slice(
      uint8.byteOffset,
      uint8.byteOffset + uint8.byteLength
    ) as ArrayBuffer
    expect(() => Otbm().validate(ab)).not.toThrow()
  })
})

// ─── load() edge cases ────────────────────────────────────────────────────────

describe('Otbm — load() edge cases', () => {
  it('throws ParseError when buffer has no root node (header stays null)', () => {
    // magic bytes followed by non-special bytes — parser never enters a node,
    // header is never set
    const buf = new Uint8Array([0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04])
    expect(() => Otbm().load(buf)).toThrow(ParseError)
  })

  it('throws ParseError when root node props are shorter than 16 bytes', () => {
    // version(4)+width(2)+height(2)+majorVersion(4) = 12 bytes, missing minorVersion(4)
    const buf = new Uint8Array([
      0x00,
      0x00,
      0x00,
      0x00, // magic
      0xfe,
      0x00, // START WORLD_NODE
      0x01,
      0x00,
      0x00,
      0x00, // version=1
      0xe8,
      0x03, // width=1000
      0xe8,
      0x03, // height=1000
      0x03,
      0x00,
      0x00,
      0x00, // majorVersion=3  — 12 bytes total, needs 16
      0xff // END → triggers "props too short" error
    ])
    expect(() => Otbm().load(buf)).toThrow(ParseError)
  })
})

// ─── remaining item attribute handlers ───────────────────────────────────────

describe('Otbm — remaining item attribute handlers', () => {
  function tileWithItem(attrs: number[]): Uint8Array {
    return buildOtbmBuffer({
      areas: [
        {
          baseX: 0,
          baseY: 0,
          baseZ: 7,
          tiles: [{ offsetX: 0, offsetY: 0, items: [{ sid: 1, attrs }] }]
        }
      ]
    })
  }

  it('TEXT (0x06) sets item.text', () => {
    const attrs = [OTBM_ATTRIBUTE.TEXT, ...str('hello')]
    const item = Otbm().load(tileWithItem(attrs)).getTile(0, 0, 7)!.items[0]!
    expect(item.text).toBe('hello')
  })

  it('DESC (0x07) sets item.text', () => {
    const attrs = [OTBM_ATTRIBUTE.DESC, ...str('desc')]
    const item = Otbm().load(tileWithItem(attrs)).getTile(0, 0, 7)!.items[0]!
    expect(item.text).toBe('desc')
  })

  it('DEPOT_ID (0x0a) sets item.depotId', () => {
    const attrs = [OTBM_ATTRIBUTE.DEPOT_ID, ...u16(7)]
    const item = Otbm().load(tileWithItem(attrs)).getTile(0, 0, 7)!.items[0]!
    expect(item.depotId).toBe(7)
  })

  it('RUNE_CHARGES (0x0c) sets item.charges via u8', () => {
    const attrs = [OTBM_ATTRIBUTE.RUNE_CHARGES, 15]
    const item = Otbm().load(tileWithItem(attrs)).getTile(0, 0, 7)!.items[0]!
    expect(item.charges).toBe(15)
  })

  it('HOUSE_DOOR (0x0e) sets item.houseDoor', () => {
    const attrs = [OTBM_ATTRIBUTE.HOUSE_DOOR, 3]
    const item = Otbm().load(tileWithItem(attrs)).getTile(0, 0, 7)!.items[0]!
    expect(item.houseDoor).toBe(3)
  })

  it('DURATION (0x10) sets item.duration via u32', () => {
    const attrs = [OTBM_ATTRIBUTE.DURATION, ...u32(3600)]
    const item = Otbm().load(tileWithItem(attrs)).getTile(0, 0, 7)!.items[0]!
    expect(item.duration).toBe(3600)
  })

  it('DECAY_STATE (0x11) sets item.decayState via u8', () => {
    const attrs = [OTBM_ATTRIBUTE.DECAY_STATE, 2]
    const item = Otbm().load(tileWithItem(attrs)).getTile(0, 0, 7)!.items[0]!
    expect(item.decayState).toBe(2)
  })
})

// ─── non-strict mode (v0) attribute parsing ───────────────────────────────────

describe('Otbm — non-strict mode (v0) attribute parsing', () => {
  const lookup: OtbLookup = { getBySid: () => ({ cid: 1 }) }

  it('parseTileAttrs non-strict: known handler is called without strict enforcement', () => {
    const buf = buildOtbmBuffer({
      version: 0,
      areas: [{ baseX: 0, baseY: 0, baseZ: 7, tiles: [{ offsetX: 0, offsetY: 0, flags: 0x01 }] }]
    })
    const tile = Otbm({ lookup }).load(buf).getTile(0, 0, 7)!
    expect(tile.flags & 0x01).toBe(1)
  })

  it('parseTileAttrs non-strict: BufferOverflowError in handler is caught and tile is still added', () => {
    // TILE_FLAGS handler reads u32 but only 1 byte follows — BufferOverflowError caught
    const buf = new Uint8Array([
      0x00,
      0x00,
      0x00,
      0x00, // magic
      0xfe,
      0x00, // START WORLD_NODE
      0x00,
      0x00,
      0x00,
      0x00, // version=0
      0xe8,
      0x03, // width=1000
      0xe8,
      0x03, // height=1000
      0x03,
      0x00,
      0x00,
      0x00, // majorVersion=3
      0x39,
      0x00,
      0x00,
      0x00, // minorVersion=57
      0xfe,
      0x02, // START MAP_DATA
      0xfe,
      0x04, // START TILE_AREA
      0x05,
      0x00, // baseX=5
      0x05,
      0x00, // baseY=5
      0x07, // baseZ=7
      0xfe,
      0x05, // START TILE
      0x01, // offsetX=1
      0x01, // offsetY=1
      0x03, // TILE_FLAGS attr (u32 handler, only 1 byte of data follows)
      0x01, // truncated
      0xff, // END TILE
      0xff, // END TILE_AREA
      0xff, // END MAP_DATA
      0xff // END WORLD_NODE
    ])
    expect(Otbm({ lookup }).load(buf).getTile(6, 6, 7)).toBeDefined()
  })

  it('parseItemAttrs non-strict: unknown attr stops parsing without throwing', () => {
    // 0x7F is not a known item attr; non-strict breaks instead of throwing ParseError,
    // so COUNT after it is never read
    const attrs = [0x7f, 0x01, 0x02, OTBM_ATTRIBUTE.COUNT, 3]
    const buf = buildOtbmBuffer({
      version: 0,
      areas: [
        {
          baseX: 0,
          baseY: 0,
          baseZ: 7,
          tiles: [{ offsetX: 0, offsetY: 0, items: [{ sid: 1, attrs }] }]
        }
      ]
    })
    const item = Otbm({ lookup }).load(buf).getTile(0, 0, 7)!.items[0]!
    expect(item.count).toBeUndefined()
  })

  it('parseItemAttrs non-strict: BufferOverflowError in handler is caught and item is still added', () => {
    // ACTION_ID handler reads u16 but only 1 byte follows — BufferOverflowError caught
    const buf = new Uint8Array([
      0x00,
      0x00,
      0x00,
      0x00, // magic
      0xfe,
      0x00, // START WORLD_NODE
      0x00,
      0x00,
      0x00,
      0x00, // version=0
      0xe8,
      0x03, // width=1000
      0xe8,
      0x03, // height=1000
      0x03,
      0x00,
      0x00,
      0x00, // majorVersion=3
      0x39,
      0x00,
      0x00,
      0x00, // minorVersion=57
      0xfe,
      0x02, // START MAP_DATA
      0xfe,
      0x04, // START TILE_AREA
      0x05,
      0x00, // baseX=5
      0x05,
      0x00, // baseY=5
      0x07, // baseZ=7
      0xfe,
      0x05, // START TILE
      0x01, // offsetX=1
      0x01, // offsetY=1
      0xfe,
      0x06, // START ITEM
      0x01,
      0x00, // sid=1 (u16)
      0x04, // ACTION_ID attr (u16 handler, only 1 byte of data follows)
      0x05, // truncated
      0xff, // END ITEM
      0xff, // END TILE
      0xff, // END TILE_AREA
      0xff, // END MAP_DATA
      0xff // END WORLD_NODE
    ])
    const tile = Otbm({ lookup }).load(buf).getTile(6, 6, 7)!
    expect(tile.items).toHaveLength(1)
    expect(tile.items[0]!.actionId).toBeUndefined()
  })
})

// ─── decodeTileFlags ─────────────────────────────────────────────────────────

describe('decodeTileFlags', () => {
  it('decodes each flag bit independently', () => {
    expect(decodeTileFlags(OTBM_TILE_FLAG.PROTECTION_ZONE).protectionZone).toBe(true)
    expect(decodeTileFlags(OTBM_TILE_FLAG.NO_PVP).noPvp).toBe(true)
    expect(decodeTileFlags(OTBM_TILE_FLAG.NO_LOGOUT).noLogout).toBe(true)
    expect(decodeTileFlags(OTBM_TILE_FLAG.PVP_ZONE).pvpZone).toBe(true)
    expect(decodeTileFlags(OTBM_TILE_FLAG.REFRESH).refresh).toBe(true)
  })

  it('all flags false when bits is 0', () => {
    const flags = decodeTileFlags(0)
    expect(flags.protectionZone).toBe(false)
    expect(flags.noPvp).toBe(false)
    expect(flags.noLogout).toBe(false)
    expect(flags.pvpZone).toBe(false)
    expect(flags.refresh).toBe(false)
  })
})

// ─── tile-level ACTION_ID attr ────────────────────────────────────────────────

describe('Otbm — tile-level ACTION_ID attr', () => {
  it('tile ACTION_ID (0x04) is preserved in tile.actionId', () => {
    const buf = buildOtbmBuffer({
      areas: [
        {
          baseX: 0,
          baseY: 0,
          baseZ: 7,
          tiles: [{ offsetX: 0, offsetY: 0, tileAttrs: [OTBM_ATTRIBUTE.ACTION_ID, ...u16(42)] }]
        }
      ]
    })
    const tile = Otbm().load(buf).getTile(0, 0, 7)!
    expect(tile).toBeDefined()
    expect(tile.actionId).toBe(42)
  })

  it('tile without ACTION_ID has actionId === undefined', () => {
    const buf = buildOtbmBuffer({
      areas: [{ baseX: 0, baseY: 0, baseZ: 7, tiles: [{ offsetX: 0, offsetY: 0 }] }]
    })
    expect(Otbm().load(buf).getTile(0, 0, 7)!.actionId).toBeUndefined()
  })
})

// ─── countTileAreas ESCAPE handling ──────────────────────────────────────────

describe('Otbm — countTileAreas ESCAPE handling', () => {
  it('onProgress fires correctly when MAP_DATA props contain an ESCAPE sequence (0xFD 0xFD)', () => {
    // countTileAreas is only called when onProgress is provided; the 0xFD 0xFD in
    // MAP_DATA props exercises the escape-skip branch (i += 2) in that raw-byte scan
    const buf = new Uint8Array([
      0x00,
      0x00,
      0x00,
      0x00, // magic
      0xfe,
      0x00, // START WORLD_NODE
      0x01,
      0x00,
      0x00,
      0x00, // version=1
      0x64,
      0x00, // width=100
      0x64,
      0x00, // height=100
      0x03,
      0x00,
      0x00,
      0x00, // majorVersion=3
      0x39,
      0x00,
      0x00,
      0x00, // minorVersion=57
      0xfe,
      0x02, // START MAP_DATA
      0xfd,
      0xfd, // escaped 0xFD in MAP_DATA props
      0xfe,
      0x04, // START TILE_AREA
      0x05,
      0x00, // baseX=5
      0x05,
      0x00, // baseY=5
      0x07, // baseZ=7
      0xfe,
      0x05, // START TILE
      0x01, // offsetX=1
      0x01, // offsetY=1
      0xff, // END TILE
      0xff, // END TILE_AREA
      0xff, // END MAP_DATA
      0xff // END WORLD_NODE
    ])
    const calls: number[] = []
    Otbm().load(buf, { onProgress: (p) => calls.push(p) })
    expect(calls).toHaveLength(1)
    expect(calls[0]).toBe(1)
  })
})

// ─── write() ──────────────────────────────────────────────────────────────────

describe('Otbm — write()', () => {
  it('round-trip: load → write → load produces semantically equivalent data', () => {
    const buf = buildOtbmBuffer({
      version: 2,
      areas: [
        {
          baseX: 100,
          baseY: 200,
          baseZ: 7,
          tiles: [
            { offsetX: 0, offsetY: 0, inlineItems: [10, 20] },
            { offsetX: 1, offsetY: 0, flags: 0x01 },
            { offsetX: 2, offsetY: 0, kind: 'house', houseId: 5 }
          ]
        }
      ],
      towns: [{ id: 1, name: 'Capital', x: 100, y: 200, z: 7 }],
      waypoints: [{ name: 'Spawn', x: 50, y: 60, z: 7 }]
    })
    const original = Otbm().load(buf)
    const written = Otbm().write(original)
    const roundTripped = Otbm().load(written)

    expect(roundTripped.areas).toHaveLength(1)
    expect(roundTripped.areas[0]!.tiles).toHaveLength(3)
    expect(roundTripped.getTile(100, 200, 7)!.items).toHaveLength(2)
    expect(roundTripped.getTile(101, 200, 7)!.flags & 0x01).toBe(1)
    const houseTile = roundTripped.getTile(102, 200, 7)!
    expect(houseTile.kind).toBe('house')
    if (houseTile.kind === 'house') expect(houseTile.houseId).toBe(5)
    expect(roundTripped.towns[0]!.name).toBe('Capital')
    expect(roundTripped.waypoints[0]!.name).toBe('Spawn')
  })

  it('round-trip preserves tile actionId', () => {
    const buf = buildOtbmBuffer({
      version: 2,
      areas: [
        {
          baseX: 0,
          baseY: 0,
          baseZ: 7,
          tiles: [{ offsetX: 0, offsetY: 0, tileAttrs: [OTBM_ATTRIBUTE.ACTION_ID, ...u16(77)] }]
        }
      ]
    })
    const written = Otbm().write(Otbm().load(buf))
    expect(Otbm().load(written).getTile(0, 0, 7)!.actionId).toBe(77)
  })

  it('round-trip preserves nested container children', () => {
    const buf = buildOtbmBuffer({
      version: 2,
      areas: [
        {
          baseX: 0,
          baseY: 0,
          baseZ: 7,
          tiles: [
            {
              offsetX: 0,
              offsetY: 0,
              items: [{ sid: 10, attrs: [OTBM_ATTRIBUTE.COUNT, 1], children: [{ sid: 55 }] }]
            }
          ]
        }
      ]
    })
    const written = Otbm().write(Otbm().load(buf))
    const tile = Otbm().load(written).getTile(0, 0, 7)!
    expect(tile.items[0]!.children).toHaveLength(1)
    expect(tile.items[0]!.children![0]!.sid).toBe(55)
  })

  it('calls console.warn when header.version !== 2', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const buf = buildOtbmBuffer({ version: 1 })
    Otbm().write(Otbm().load(buf))
    expect(spy).toHaveBeenCalledOnce()
    spy.mockRestore()
  })

  it('does not call console.warn when header.version === 2', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const buf = buildOtbmBuffer({ version: 2 })
    Otbm().write(Otbm().load(buf))
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  it('onProgress called once per area, last value is 1, values increasing', () => {
    const buf = buildOtbmBuffer({
      version: 2,
      areas: [
        { baseX: 0, baseY: 0, baseZ: 7, tiles: [{ offsetX: 0, offsetY: 0 }] },
        { baseX: 100, baseY: 0, baseZ: 7, tiles: [{ offsetX: 0, offsetY: 0 }] },
        { baseX: 200, baseY: 0, baseZ: 7, tiles: [{ offsetX: 0, offsetY: 0 }] }
      ]
    })
    const calls: number[] = []
    Otbm().write(Otbm().load(buf), { onProgress: (p) => calls.push(p) })
    expect(calls).toHaveLength(3)
    expect(calls[calls.length - 1]).toBe(1)
    for (let i = 1; i < calls.length; i++) {
      expect(calls[i]).toBeGreaterThan(calls[i - 1]!)
    }
  })

  it('throws RangeError for tile with offset overflow', () => {
    const file = Otbm().load(buildOtbmBuffer({ version: 2 }))
    file.areas.push({
      baseX: 0,
      baseY: 0,
      baseZ: 7,
      tiles: [{ kind: 'tile', x: 300, y: 0, z: 7, flags: 0, items: [] }]
    })
    expect(() => Otbm().write(file)).toThrow(RangeError)
  })

  it('throws RangeError for item with invalid sid', () => {
    const file = Otbm().load(buildOtbmBuffer({ version: 2 }))
    file.areas.push({
      baseX: 0,
      baseY: 0,
      baseZ: 7,
      tiles: [{ kind: 'tile', x: 0, y: 0, z: 7, flags: 0, items: [{ sid: NaN }] }]
    })
    expect(() => Otbm().write(file)).toThrow(RangeError)
  })
})

// ─── writeStream() ────────────────────────────────────────────────────────────

describe('Otbm — writeStream()', () => {
  async function collectStream(iter: AsyncIterable<Uint8Array>): Promise<Uint8Array> {
    const chunks: Uint8Array[] = []
    for await (const chunk of iter) chunks.push(chunk)
    const total = chunks.reduce((s, c) => s + c.length, 0)
    const out = new Uint8Array(total)
    let off = 0
    for (const c of chunks) {
      out.set(c, off)
      off += c.length
    }
    return out
  }

  it('concatenated chunks produce output equal to write()', async () => {
    const buf = buildOtbmBuffer({
      version: 2,
      areas: [
        { baseX: 0, baseY: 0, baseZ: 7, tiles: [{ offsetX: 0, offsetY: 0 }] },
        { baseX: 100, baseY: 0, baseZ: 7, tiles: [{ offsetX: 0, offsetY: 0 }] }
      ],
      towns: [{ id: 1, name: 'Town', x: 0, y: 0, z: 7 }]
    })
    const file = Otbm().load(buf)
    const fromWrite = Otbm().write(file)
    const fromStream = await collectStream(Otbm().writeStream(file))
    expect(fromStream).toEqual(fromWrite)
  })

  it('onProgress dispatched between yields, last value is 1', async () => {
    const buf = buildOtbmBuffer({
      version: 2,
      areas: [
        { baseX: 0, baseY: 0, baseZ: 7, tiles: [{ offsetX: 0, offsetY: 0 }] },
        { baseX: 100, baseY: 0, baseZ: 7, tiles: [{ offsetX: 0, offsetY: 0 }] }
      ]
    })
    const file = Otbm().load(buf)
    const calls: number[] = []
    await collectStream(Otbm().writeStream(file, { onProgress: (p) => calls.push(p) }))
    expect(calls).toHaveLength(2)
    expect(calls[calls.length - 1]).toBe(1)
  })
})
