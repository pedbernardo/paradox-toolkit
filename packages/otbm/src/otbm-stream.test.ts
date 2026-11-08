import { describe, expect, it } from 'vitest'
import { ParseError, windows1250, windows1252 } from '@paradoxlab/utils'
import { readOtbm } from './otbm-stream.js'
import {
  headerProps,
  mapBytes,
  node,
  otbmBytes,
  str,
  u16,
  u32
} from '../tests/support/otbm-bytes.js'
import { recorder } from '../tests/support/otbm-recorder.js'
import type { OtbmDiagnostic, OtbmLimits, OtbmOptions } from './types.js'

const AREA = 4
const TILE = 5
const ITEM = 6
const TOWNS = 12
const TOWN = 13
const HOUSE_TILE = 14
const WAYPOINTS = 15
const WAYPOINT = 16

const area = (...children: ReturnType<typeof node>[]) =>
  node(AREA, [...u16(256), ...u16(512), 7], ...children)

function read(bytes: Uint8Array, options = {}) {
  const r = recorder()
  readOtbm(bytes, r.visitor, options)
  return r
}

describe('readOtbm - structure', () => {
  it('reports a full map in file order with its shape', () => {
    const bytes = otbmBytes(
      node(
        1,
        headerProps(2, 2048, 1024, 3, 57),
        node(
          2,
          [1, ...str('made by hand'), 0x0b, ...str('spawn.xml'), 0x0d, ...str('house.xml')],
          area(
            node(
              TILE,
              [1, 2, 3, ...u32(0), 9, ...u16(100), 9, ...u16(101)],
              node(ITEM, [...u16(2148), 0x0f, 7])
            ),
            node(HOUSE_TILE, [0, 0, ...u32(0)])
          ),
          node(TOWNS, [], node(TOWN, [...u32(1), ...str('Thais'), ...u16(300), ...u16(600), 7])),
          node(WAYPOINTS)
        )
      )
    )
    const { events } = read(bytes)
    expect(events).toEqual([
      [
        'header',
        {
          identifier: 0,
          version: 2,
          width: 2048,
          height: 1024,
          otbMajor: 3,
          otbMinor: 57,
          rootType: 1,
          tail: null
        }
      ],
      [
        'mapData',
        {
          attributes: [
            { kind: 'description', value: 'made by hand' },
            { kind: 'spawnFile', value: 'spawn.xml' },
            { kind: 'houseFile', value: 'house.xml' }
          ]
        }
      ],
      ['area', 256, 512, 7, null],
      ['tile', 257, 514, 7, 0, null, null],
      ['item', 100, 'inline', null],
      ['itemEnd'],
      ['item', 101, 'inline', null],
      ['itemEnd'],
      ['item', 2148, 'node', [{ kind: 'count', value: 7 }]],
      ['itemEnd'],
      ['tileEnd'],
      ['tile', 256, 512, 7, null, 0, null],
      ['tileEnd'],
      ['areaEnd'],
      ['list', 'towns'],
      ['town', { id: 1, name: 'Thais', x: 300, y: 600, z: 7, tail: null }],
      ['listEnd'],
      ['list', 'waypoints'],
      ['listEnd'],
      ['mapDataEnd'],
      ['end', null]
    ])
  })

  it('reads every known item attribute in file order', () => {
    const props = [
      ...u16(1987),
      0x04,
      ...u16(1000),
      0x05,
      ...u16(2000),
      0x06,
      ...str('hello'),
      0x07,
      ...str('desc'),
      0x08,
      ...u16(100),
      ...u16(200),
      7,
      0x0a,
      ...u16(3),
      0x0c,
      5,
      0x0e,
      9,
      0x0f,
      20,
      0x10,
      ...u32(60_000),
      0x11,
      2,
      0x12,
      ...u32(1_700_000_000),
      0x13,
      ...str('Avar Tar'),
      0x14,
      ...u32(42),
      0x15,
      ...u32(43),
      0x16,
      ...u16(500)
    ]
    const { events } = read(mapBytes([area(node(TILE, [0, 0], node(ITEM, props)))]))
    expect(events.find(([name]) => name === 'item')).toEqual([
      'item',
      1987,
      'node',
      [
        { kind: 'actionId', value: 1000 },
        { kind: 'uniqueId', value: 2000 },
        { kind: 'text', value: 'hello' },
        { kind: 'description', value: 'desc' },
        { kind: 'teleport', x: 100, y: 200, z: 7 },
        { kind: 'depotId', value: 3 },
        { kind: 'runeCharges', value: 5 },
        { kind: 'houseDoorId', value: 9 },
        { kind: 'count', value: 20 },
        { kind: 'duration', value: 60_000 },
        { kind: 'decayState', value: 2 },
        { kind: 'writtenDate', value: 1_700_000_000 },
        { kind: 'writtenBy', value: 'Avar Tar' },
        { kind: 'sleeperGuid', value: 42 },
        { kind: 'sleepStart', value: 43 },
        { kind: 'charges', value: 500 }
      ]
    ])
  })

  it('keeps nested items, closing each with itemEnd', () => {
    const backpack = node(ITEM, u16(1988), node(ITEM, u16(2148), node(ITEM, u16(2152))))
    const { events } = read(mapBytes([area(node(TILE, [0, 0], backpack))]))
    const names = events.map(([name, sid]) => (name === 'item' ? `item ${sid}` : name))
    expect(names.slice(4, 11)).toEqual([
      'item 1988',
      'item 2148',
      'item 2152',
      'itemEnd',
      'itemEnd',
      'itemEnd',
      'tileEnd'
    ])
  })

  it('keeps unknown attributes as the tail of tiles, items and map data', () => {
    const bytes = mapBytes(
      [
        area(
          node(
            TILE,
            [0, 0, 0x03, ...u32(1), 0x77, 1, 2],
            node(ITEM, [...u16(100), 0x04, ...u16(5), 0x99, 8])
          )
        )
      ],
      2,
      [1, ...str('d'), 0x42, 9]
    )
    const { events } = read(bytes)
    expect(events[1]).toEqual([
      'mapData',
      {
        attributes: [
          { kind: 'description', value: 'd' },
          { kind: 'unknown', bytes: [0x42, 9] }
        ]
      }
    ])
    expect(events.find(([name]) => name === 'tile')).toEqual([
      'tile',
      256,
      512,
      7,
      1,
      null,
      [0x77, 1, 2]
    ])
    expect(events.find(([name]) => name === 'item')).toEqual([
      'item',
      100,
      'node',
      [
        { kind: 'actionId', value: 5 },
        { kind: 'unknown', bytes: [0x99, 8] }
      ]
    ])
  })

  it('keeps unknown nodes verbatim, children and escapes included', () => {
    const unknownInItem = node(0x30, [0xfe, 1], node(0x31, [2]))
    const bytes = mapBytes([
      area(node(TILE, [0, 0], node(ITEM, u16(100), unknownInItem))),
      node(3, [0xaa])
    ])
    const { events } = read(bytes)
    const unknown = events.filter(([name]) => name === 'unknownNode')
    expect(unknown).toEqual([
      ['unknownNode', 0x30, [0xfe, 0x30, 0xfd, 0xfe, 1, 0xfe, 0x31, 2, 0xff, 0xff]],
      ['unknownNode', 3, [0xfe, 3, 0xaa, 0xff]]
    ])
  })

  it('distinguishes a flags attribute with value 0 from no flags', () => {
    const { events } = read(
      mapBytes([area(node(TILE, [0, 0, 0x03, ...u32(0)]), node(TILE, [1, 0]))])
    )
    const tiles = events.filter(([name]) => name === 'tile')
    expect(tiles.map((tile) => tile[4])).toEqual([0, null])
  })

  it('unescapes property bytes', () => {
    const { events } = read(mapBytes([area(node(TILE, [0, 0], node(ITEM, u16(0xfdfe))))]))
    expect(events.find(([name]) => name === 'item')?.[1]).toBe(0xfdfe)
  })

  it('keeps the root type, the identifier, the header tail and the trailing bytes', () => {
    const root = node(1, [...headerProps(2), 0x55], node(2))
    const bytes = otbmBytes(root, [0xff, 0x01])
    bytes.set([1, 2, 3, 4], 0)
    const { events } = read(bytes)
    expect(events[0]).toEqual([
      'header',
      expect.objectContaining({ identifier: 0x04030201, rootType: 1, tail: [0x55] })
    ])
    expect(events.at(-1)).toEqual(['end', [0xff, 0x01]])
  })

  it('reads waypoints with a tail', () => {
    const bytes = mapBytes(
      [node(WAYPOINTS, [], node(WAYPOINT, [...str('temple'), ...u16(1), ...u16(2), 7, 9]))],
      2
    )
    const { events } = read(bytes)
    expect(events.find(([name]) => name === 'waypoint')).toEqual([
      'waypoint',
      { name: 'temple', x: 1, y: 2, z: 7, tail: [9] }
    ])
  })
})

describe('readOtbm - OTBM v1 inline counts', () => {
  const v1 = mapBytes(
    [
      area(
        node(
          TILE,
          [0, 0],
          node(ITEM, [...u16(2148), 25, 0x04, ...u16(7)]),
          node(ITEM, [...u16(1987), 0x04, ...u16(8)])
        )
      )
    ],
    0
  )
  const hasInlineCount = (sid: number) => sid === 2148

  it('reads the untagged count as the first attribute of a node+inlineCount item', () => {
    const items = read(v1, { hasInlineCount }).events.filter(([name]) => name === 'item')
    expect(items).toEqual([
      [
        'item',
        2148,
        'node+inlineCount',
        [
          { kind: 'count', value: 25 },
          { kind: 'actionId', value: 7 }
        ]
      ],
      ['item', 1987, 'node', [{ kind: 'actionId', value: 8 }]]
    ])
  })

  it('refuses to read v1 without the predicate', () => {
    expect(() => read(v1)).toThrow(/hasInlineCount/)
  })

  it('does not read a count byte when the item has no properties left', () => {
    const bare = mapBytes([area(node(TILE, [0, 0], node(ITEM, u16(2148))))], 0)
    const item = read(bare, { hasInlineCount }).events.find(([name]) => name === 'item')
    expect(item).toEqual(['item', 2148, 'node', null])
  })
})

describe('readOtbm - strings', () => {
  const sign = (bytes: number[]) =>
    mapBytes([area(node(TILE, [0, 0], node(ITEM, [...u16(1), 0x06, ...str(bytes)])))])
  const textOf = (r: ReturnType<typeof read>) =>
    (r.events.find(([name]) => name === 'item')![3] as { value: string }[])[0]?.value

  it('decodes windows-1252 by default', () => {
    expect(textOf(read(sign([0x69, 0x74, 0x92, 0x73])))).toBe('it’s')
  })

  it('decodes with the given codec', () => {
    expect(textOf(read(sign([0xb3, 0xb9, 0x6b, 0x61]), { text: windows1250 }))).toBe('łąka')
  })
})

describe('readOtbm - malformed input', () => {
  it('rejects a file without a node start at offset 4', () => {
    expect(() => read(Uint8Array.of(0, 0, 0, 0, 0, 0))).toThrow(ParseError)
  })

  it('rejects a header with fewer than 16 property bytes', () => {
    expect(() => read(otbmBytes(node(0, [1, 2, 3])))).toThrow(/at least 16/)
  })

  it('rejects truncated properties', () => {
    expect(() => read(mapBytes([node(AREA, [1, 2])]))).toThrow(/ends before its properties/)
  })

  it('rejects a file that ends with open nodes', () => {
    const bytes = mapBytes([area()])
    expect(() => read(bytes.subarray(0, bytes.length - 2))).toThrow(ParseError)
  })

  it('rejects bytes between nodes', () => {
    const bytes = Uint8Array.from([...mapBytes([area()]).subarray(0, 4 + 18 + 2), 0x00])
    expect(() => read(bytes)).toThrow(ParseError)
  })
})

describe('readOtbm - progress', () => {
  it('reports the end', () => {
    const calls: number[][] = []
    const r = recorder()
    const bytes = mapBytes([area()])
    readOtbm(bytes, r.visitor, {}, { onProgress: (offset, total) => calls.push([offset, total]) })
    expect(calls.at(-1)).toEqual([bytes.length, bytes.length])
  })
})

describe('diagnostics and ceilings', () => {
  const area = (...children: ReturnType<typeof node>[]) =>
    node(AREA, [...u16(0), ...u16(0), 7], ...children)
  const tile = (...children: ReturnType<typeof node>[]) => node(TILE, [0, 0], ...children)
  const item = (...children: ReturnType<typeof node>[]) => node(ITEM, u16(100), ...children)

  function diagnosticsOf(bytes: Uint8Array, options: OtbmOptions = {}): OtbmDiagnostic[] {
    const r = recorder()
    readOtbm(bytes, r.visitor, options)
    return r.diagnostics as OtbmDiagnostic[]
  }
  const codes = (bytes: Uint8Array, options: OtbmOptions = {}) =>
    diagnosticsOf(bytes, options).map((d) => d.code)

  describe('diagnostics', () => {
    it('reports nothing for a well-formed map', () => {
      expect(codes(mapBytes([area(tile(item()))]))).toEqual([])
    })

    it('reports a file above the warning size', () => {
      const bytes = mapBytes([area(tile())])
      expect(codes(bytes, { limits: { fileWarnBytes: 10 } })).toEqual(['file-above-reference'])
    })

    it('keeps a tile outside an area as an unknown node', () => {
      const r = recorder()
      readOtbm(mapBytes([area(tile()), node(TILE, [1, 1])]), r.visitor)
      expect((r.diagnostics as OtbmDiagnostic[]).map((d) => d.code)).toEqual(['tile-outside-area'])
      expect(r.events.filter(([name]) => name === 'unknownNode')).toHaveLength(1)
    })

    it('reads areas under the root in place and reports them', () => {
      const bytes = otbmBytes(node(0, headerProps(), node(2), area(tile())))
      const r = recorder()
      readOtbm(bytes, r.visitor)
      expect(r.events.map(([name]) => name)).toEqual([
        'header',
        'mapData',
        'mapDataEnd',
        'area',
        'tile',
        'tileEnd',
        'areaEnd',
        'end'
      ])
      expect((r.diagnostics as OtbmDiagnostic[]).map((d) => d.code)).toEqual(['node-out-of-place'])
    })

    it('reports known node types in an unexpected place and unknown types apart', () => {
      expect(codes(mapBytes([area(tile(node(AREA, [0])))]))).toEqual(['node-out-of-place'])
      expect(codes(mapBytes([area(tile()), node(0x40)]))).toEqual(['unknown-node'])
    })

    it('keeps a list with properties as an unknown node', () => {
      const r = recorder()
      readOtbm(mapBytes([area(tile()), node(12, [1])]), r.visitor)
      expect(r.events.filter(([name]) => name === 'unknownNode')).toEqual([
        ['unknownNode', 12, [0xfe, 12, 1, 0xff]]
      ])
    })

    it('keeps extra area properties as the area tail', () => {
      const bytes = mapBytes([node(AREA, [...u16(0), ...u16(0), 7, 1, 2], tile())])
      expect(codes(bytes)).toEqual(['area-properties-extra'])
    })

    it('reports trailing bytes', () => {
      const trailing = otbmBytes(node(0, headerProps(), node(2, [], area(tile()))), [0xff])
      expect(diagnosticsOf(trailing)).toEqual([
        {
          code: 'trailing-bytes',
          offset: trailing.length - 1,
          count: 1,
          message: expect.any(String)
        }
      ])
    })

    it('reports strings that look like UTF-8 when reading them as a code page', () => {
      const bytes = mapBytes([area(tile(node(ITEM, [...u16(1), 0x06, ...str([0xc3, 0xa3])])))])
      expect(codes(bytes, { text: windows1252 })).toEqual(['possible-utf8-text'])
    })

    it('reports each code once, at the end, with the first offset and the count', () => {
      const bytes = mapBytes([
        area(tile()),
        ...Array.from({ length: 13 }, () => node(TILE, [0, 0]))
      ])
      const r = recorder()
      readOtbm(bytes, r.visitor)
      expect(r.diagnostics).toEqual([
        {
          code: 'tile-outside-area',
          offset: expect.any(Number),
          count: 13,
          message: expect.any(String)
        }
      ])
      expect(r.events.at(-1)?.[0]).toBe('end')
    })
  })

  describe('ceilings', () => {
    const read = (bytes: Uint8Array, limits: Partial<OtbmLimits>) => () =>
      diagnosticsOf(bytes, { limits })

    it('refuses files above the fatal size', () => {
      expect(read(mapBytes([area(tile())]), { fileBytes: 10 })).toThrow(/ceiling/)
    })

    it('stops at the limits of items per tile, container children, nesting and properties', () => {
      expect(read(mapBytes([area(tile(item(), item(), item()))]), { itemsPerTile: 2 })).toThrow(
        /more than 2 items/
      )
      const inlineItems = [0x09, ...u16(1), 0x09, ...u16(2), 0x09, ...u16(3)]
      expect(
        read(mapBytes([area(node(TILE, [0, 0, ...inlineItems]))]), { itemsPerTile: 2 })
      ).toThrow(/more than 2 items/)
      expect(read(mapBytes([area(tile(item(item(), item())))]), { containerChildren: 1 })).toThrow(
        /Container/
      )
      expect(read(mapBytes([area(tile(item(item(item()))))]), { itemNesting: 2 })).toThrow(/nested/)
      const big = mapBytes([area(tile(node(ITEM, [...u16(1), 0x06, ...str('x'.repeat(100))])))])
      expect(read(big, { nodePropertyBytes: 64 })).toThrow(/property bytes/)
    })
  })
})
