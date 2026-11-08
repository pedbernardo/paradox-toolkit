import { describe, expect, it } from 'vitest'
import { Otbm } from './otbm.js'
import { compareOtbm } from './otbm-compare.js'
import {
  headerProps,
  mapBytes,
  node,
  otbmBytes,
  str,
  u16,
  u32
} from '../tests/support/otbm-bytes.js'
import type { OtbmDocumentItem } from './types.js'

const AREA = 4
const TILE = 5
const ITEM = 6
const area = (x: number, ...children: ReturnType<typeof node>[]) =>
  node(AREA, [...u16(x), ...u16(0), 7], ...children)

const base = mapBytes([
  area(
    0,
    node(
      TILE,
      [0, 0, 0x03, ...u32(0), 0x09, ...u16(100)],
      node(ITEM, [...u16(200), 0x04, ...u16(1), 0x05, ...u16(2)])
    )
  ),
  area(256, node(TILE, [0, 0]))
])
const load = (bytes: Uint8Array) => Otbm().load(bytes)

describe('compareOtbm', () => {
  it('finds no difference between a map and itself', () => {
    expect(compareOtbm(load(base), load(base))).toEqual([])
  })

  it('ignores the Shape: inline vs node, attribute order, area layout, flags 0 vs none', () => {
    const reshaped = mapBytes([
      area(256, node(TILE, [0, 0])),
      area(
        0,
        node(
          TILE,
          [0, 0],
          node(ITEM, u16(100)),
          node(ITEM, [...u16(200), 0x05, ...u16(2), 0x04, ...u16(1)])
        )
      )
    ])
    expect(compareOtbm(load(base), load(reshaped))).toEqual([])
  })

  it('reports each kind of difference once, with its path', () => {
    const a = load(base)
    const b = load(base)
    b.header = { ...b.header, width: 5 }
    b.mapData = { attributes: [{ kind: 'description', value: 'x' }] }
    const tile = b.getTile(0, 0, 7)!
    tile.flags = 4
    tile.houseId = 9
    tile.tail = Uint8Array.of(0x77)
    ;(tile.items[1] as OtbmDocumentItem).attributes = [{ kind: 'actionId', value: 9 }]
    ;((tile.items[1] as OtbmDocumentItem).children ??= []).push({
      kind: 'item',
      sid: 1,
      form: 'node',
      attributes: null,
      children: []
    })
    expect(compareOtbm(a, b).map((d) => d.path)).toEqual([
      'header width',
      'map data',
      'tile 0,0,7 flags',
      'tile 0,0,7 houseId',
      'tile 0,0,7 tail',
      'tile 0,0,7 item 1 attributes',
      'tile 0,0,7 item 1 items'
    ])
  })

  it('reports missing tiles on either side, sids and unknown nodes', () => {
    const left = load(
      mapBytes([
        area(0, node(TILE, [0, 0], node(ITEM, u16(1)), node(0x30, [1])), node(TILE, [1, 0]))
      ])
    )
    const right = load(
      mapBytes([
        area(0, node(TILE, [0, 0], node(ITEM, u16(2)), node(0x30, [2])), node(TILE, [2, 0]))
      ])
    )
    expect(compareOtbm(left, right).map((d) => d.path)).toEqual([
      'tile 0,0,7 item 0 sid',
      'tile 0,0,7 item 1 unknown',
      'tile 1,0,7',
      'tile 2,0,7'
    ])
  })

  it('compares towns, waypoints and unknown nodes outside tiles', () => {
    const withTown = (name: string) =>
      otbmBytes(
        node(
          0,
          headerProps(),
          node(
            2,
            [],
            node(12, [], node(13, [...u32(1), ...str(name), ...u16(1), ...u16(1), 7])),
            node(0x31, [1])
          )
        )
      )
    expect(
      compareOtbm(load(withTown('Thais')), load(withTown('Carlin'))).map((d) => d.path)
    ).toEqual(['structure'])
  })

  it('stops at the limit', () => {
    const many = (sid: number) =>
      load(
        mapBytes([
          area(0, ...Array.from({ length: 10 }, (_, i) => node(TILE, [i, 0], node(ITEM, u16(sid)))))
        ])
      )
    expect(compareOtbm(many(1), many(2), { limit: 3 })).toHaveLength(3)
  })
})
