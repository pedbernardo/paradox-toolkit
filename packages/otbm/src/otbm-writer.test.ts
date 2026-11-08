import { describe, expect, it } from 'vitest'
import { UnencodableTextError, createOutputBuffer, windows1250 } from '@paradoxlab/utils'
import { OtbmEncodeError, createOtbmEncoder } from './otbm-writer.js'
import { Otbm } from './otbm.js'
import {
  headerProps,
  mapBytes,
  node,
  otbmBytes,
  str,
  u16,
  u32
} from '../tests/support/otbm-bytes.js'
import type { OtbmHeader, OtbmOptions, OtbmSource, OtbmVisitor } from './types.js'

const AREA = 4
const TILE = 5
const ITEM = 6
const area = (...children: ReturnType<typeof node>[]) =>
  node(AREA, [...u16(256), ...u16(256), 7], ...children)

const roundTrip = (bytes: Uint8Array, options: OtbmOptions = {}) => {
  const otbm = Otbm(options)
  return otbm.write(otbm.source(bytes))
}

const HEADER: OtbmHeader = {
  identifier: 0,
  version: 2,
  width: 100,
  height: 100,
  otbMajor: 3,
  otbMinor: 57,
  rootType: 0,
  tail: null
}

/** Encodes events produced by `emit`, returning the bytes. */
function encode(
  emit: (visitor: Required<OtbmVisitor>) => void,
  options: OtbmOptions = {}
): Uint8Array {
  const output = createOutputBuffer({
    initialBytes: 64,
    ...(options.text ? { text: options.text } : {})
  })
  const encoder = createOtbmEncoder(output, options)
  emit(encoder)
  return output.take()
}

const inMap = (visitor: Required<OtbmVisitor>, body: () => void, header = HEADER) => {
  visitor.header(header)
  visitor.mapData({ attributes: [] })
  visitor.area(256, 256, 7, null)
  body()
  visitor.areaEnd()
  visitor.mapDataEnd()
  visitor.end(null)
}

describe('encoder: byte-identical roundtrip of synthetic maps', () => {
  const cases: [string, Uint8Array][] = [
    [
      'every attribute, nesting, inline items, tails and lists',
      otbmBytes(
        node(
          1,
          [...headerProps(2), 0x77],
          node(
            2,
            [1, ...str('desc'), 0x0b, ...str('s.xml'), 0x0d, ...str('h.xml'), 0x99],
            area(
              node(
                TILE,
                [1, 1, 0x03, ...u32(0), 0x09, ...u16(4526), 0x09, ...u16(4527), 0x55],
                node(
                  ITEM,
                  [
                    ...u16(1987),
                    0x04,
                    ...u16(1),
                    0x06,
                    ...str('ÿ’'),
                    0x08,
                    ...u16(1),
                    ...u16(2),
                    7,
                    0x16,
                    ...u16(9)
                  ],
                  node(ITEM, [...u16(2148), 0x0f, 100])
                )
              ),
              node(14, [2, 2, ...u32(0)])
            ),
            node(12, [], node(13, [...u32(1), ...str('Thais'), ...u16(1), ...u16(2), 7])),
            node(15, [], node(16, [...str('wp'), ...u16(3), ...u16(4), 5, 0xab]))
          )
        ),
        [0xff]
      )
    ],
    [
      'unknown nodes in items and map data',
      mapBytes([area(node(TILE, [0, 0], node(ITEM, u16(1), node(0x30, [0xfd])))), node(3, [1])])
    ],
    [
      'an area under the root',
      otbmBytes(node(0, headerProps(), node(2), area(node(TILE, [0, 0]))))
    ],
    [
      'escaped values everywhere',
      mapBytes([
        node(
          AREA,
          [...u16(0xfefd), ...u16(0xfffe), 0xfd],
          node(TILE, [0xfe, 0xff], node(ITEM, u16(0xfdfd)))
        )
      ])
    ]
  ]

  it.each(cases)('%s', (_, bytes) => {
    expect(roundTrip(bytes)).toEqual(bytes)
  })

  it('writes v1 inline counts back as untagged bytes', () => {
    const v1 = mapBytes(
      [area(node(TILE, [0, 0], node(ITEM, [...u16(2148), 25, 0x04, ...u16(7)])))],
      0
    )
    expect(roundTrip(v1, { hasInlineCount: (sid) => sid === 2148 })).toEqual(v1)
  })

  it('writes strings with the given codec', () => {
    const bytes = mapBytes([
      area(node(TILE, [0, 0], node(ITEM, [...u16(1), 0x06, ...str([0xb3, 0xb9])])))
    ])
    expect(roundTrip(bytes, { text: windows1250 })).toEqual(bytes)
  })
})

describe('encoder: what it writes from events', () => {
  it('puts inline items and the tile tail in the tile properties, before any item node', () => {
    const bytes = encode((v) =>
      inMap(v, () => {
        v.tile(257, 257, 7, null, null, Uint8Array.of(0x42))
        v.item(100, 'inline', null)
        v.itemEnd()
        v.item(200, 'node', null)
        v.itemEnd()
        v.tileEnd()
      })
    )
    const tileStart = bytes.indexOf(TILE, 30) - 1
    expect([...bytes.subarray(tileStart, tileStart + 12)]).toEqual([
      0xfe,
      TILE,
      1,
      1,
      0x09,
      100,
      0,
      0x42,
      0xfe,
      ITEM,
      200,
      0
    ])
  })

  it('promotes a v1 node item with a count to an inline count when the sid needs it', () => {
    const bytes = encode(
      (v) =>
        inMap(
          v,
          () => {
            v.tile(256, 256, 7, null, null, null)
            v.item(2148, 'node', [
              { kind: 'actionId', value: 3 },
              { kind: 'count', value: 9 }
            ])
            v.itemEnd()
            v.tileEnd()
          },
          { ...HEADER, version: 0 }
        ),
      { hasInlineCount: (sid) => sid === 2148 }
    )
    const itemStart = bytes.lastIndexOf(0xfe) - 0
    expect([...bytes.subarray(itemStart, itemStart + 8)]).toEqual([
      0xfe,
      ITEM,
      0x64,
      0x08,
      9,
      0x04,
      3,
      0
    ])
  })
})

describe('encoder: rejects malformed event sequences', () => {
  const fails = (body: (v: Required<OtbmVisitor>) => void, options: OtbmOptions = {}) =>
    expect(() => encode((v) => inMap(v, () => body(v)), options))

  it('rejects a tile outside its area', () => {
    fails((v) => v.tile(0, 0, 7, null, null, null)).toThrow(OtbmEncodeError)
    fails((v) => v.tile(256, 256, 6, null, null, null)).toThrow(/outside the area/)
  })

  it('rejects an inline item after a node item or with attributes', () => {
    fails((v) => {
      v.tile(256, 256, 7, null, null, null)
      v.item(1, 'node', null)
      v.itemEnd()
      v.item(2, 'inline', null)
    }).toThrow(/cannot be inline/)
    fails((v) => {
      v.tile(256, 256, 7, null, null, null)
      v.item(2, 'inline', [{ kind: 'actionId', value: 1 }])
    }).toThrow(/cannot be inline/)
  })

  it('rejects an inline count outside v1 or without a leading count', () => {
    fails((v) => {
      v.tile(256, 256, 7, null, null, null)
      v.item(2148, 'node+inlineCount', [{ kind: 'count', value: 1 }])
    }).toThrow(/only exists in OTBM v1/)
  })

  it('rejects unbalanced events and events out of place', () => {
    expect(() => encode((v) => v.mapDataEnd())).toThrow(OtbmEncodeError)
    expect(() =>
      encode((v) => {
        v.header(HEADER)
        v.tileEnd()
      })
    ).toThrow(OtbmEncodeError)
    expect(() =>
      encode((v) => {
        v.header(HEADER)
        v.header(HEADER)
      })
    ).toThrow(/first event/)
    expect(() =>
      encode((v) => {
        v.header(HEADER)
        v.mapData({ attributes: [] })
        v.town({ id: 1, name: '', x: 0, y: 0, z: 0, tail: null })
      })
    ).toThrow(OtbmEncodeError)
    fails((v) => v.itemEnd()).toThrow(/without an open item/)
  })

  it('rejects an unknown attribute that is not the last one', () => {
    fails((v) => {
      v.tile(256, 256, 7, null, null, null)
      v.item(1, 'node', [
        { kind: 'unknown', bytes: Uint8Array.of(1) },
        { kind: 'actionId', value: 1 }
      ])
    }).toThrow(/last attribute/)
  })

  it('rejects nesting and tile items above the fatal limits', () => {
    const tight = {
      limits: { itemNesting: 1, itemsPerTile: 1 }
    }
    fails((v) => {
      v.tile(256, 256, 7, null, null, null)
      v.item(1, 'node', null)
      v.item(2, 'node', null)
    }, tight).toThrow(/nested/)
    fails((v) => {
      v.tile(256, 256, 7, null, null, null)
      v.item(1, 'inline', null)
      v.itemEnd()
      v.item(2, 'inline', null)
    }, tight).toThrow(/more than 1 items/)
  })

  it('throws instead of substituting a character the codec cannot encode', () => {
    fails((v) => {
      v.tile(256, 256, 7, null, null, null)
      v.item(1, 'node', [{ kind: 'text', value: 'ok 🙂' }])
    }).toThrow(UnencodableTextError)
  })
})

describe('writeStream', () => {
  const big = mapBytes(
    Array.from({ length: 20 }, (_area, a) =>
      node(
        AREA,
        [...u16(a * 256), ...u16(0), 7],
        ...Array.from({ length: 50 }, (_tile, t) => node(TILE, [t, 0], node(ITEM, u16(100 + t))))
      )
    )
  )

  it('hands out chunks of about chunkBytes that add up to the file', () => {
    const otbm = Otbm()
    const chunks = [...otbm.writeStream(otbm.source(big), { chunkBytes: 512 })]
    expect(chunks.length).toBeGreaterThan(5)
    const areaBytes = big.length / 20
    for (const chunk of chunks.slice(0, -1)) expect(chunk.length).toBeLessThan(512 + areaBytes + 64)
    expect(Uint8Array.from(chunks.flatMap((c) => [...c]))).toEqual(big)
  })

  it('advances the source only when the consumer pulls', () => {
    const otbm = Otbm()
    let steps = 0
    const inner = otbm.source(big)
    const counted: OtbmSource = {
      *emit(visitor) {
        for (const step of inner.emit(visitor)) {
          steps++
          yield step
        }
      }
    }
    const stream = otbm.writeStream(counted, { chunkBytes: 512 })
    stream.next()
    const afterFirst = steps
    expect(afterFirst).toBeLessThan(20)
    stream.next()
    expect(steps).toBeGreaterThan(afterFirst)
  })

  it('stops at maxBytes', () => {
    const otbm = Otbm()
    expect(() => [
      ...otbm.writeStream(otbm.source(big), { chunkBytes: 256, maxBytes: 1000 })
    ]).toThrow(/limit/)
  })

  it('fails when the source never ends the map', () => {
    const otbm = Otbm()
    const unfinished: OtbmSource = {
      emit(visitor) {
        visitor.header?.(HEADER)
        return []
      }
    }
    expect(() => otbm.write(unfinished)).toThrow(/before `end`/)
  })
})

describe('validate', () => {
  it('accepts a map and refuses what is not one or is too big', () => {
    const bytes = mapBytes([area()])
    expect(() => Otbm().validate(bytes)).not.toThrow()
    expect(() => Otbm().validate(Uint8Array.of(1, 2, 3))).toThrow(/Not an OTBM/)
    expect(() => Otbm({ limits: { fileBytes: 5 } }).validate(bytes)).toThrow(/ceiling/)
  })
})
