import { describe, expect, it } from 'vitest'
import { Otbm } from './otbm.js'
import { collectDocument } from './otbm-document.js'
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
import { drain, recorder } from '../tests/support/otbm-recorder.js'
import type { OtbmDocumentItem } from './types.js'

const AREA = 4
const TILE = 5
const ITEM = 6

const full = otbmBytes(
  node(
    1,
    headerProps(2, 512, 512),
    node(0x30, [1]),
    node(
      2,
      [1, ...str('desc')],
      node(
        AREA,
        [...u16(256), ...u16(256), 7, 9],
        node(
          TILE,
          [0, 0, 0x03, ...u32(8), 0x09, ...u16(4526), 0x77],
          node(ITEM, [...u16(1987), 0x04, ...u16(5)], node(ITEM, u16(2148)), node(0x31, [2]))
        ),
        node(TILE, [3, 4]),
        node(0x32)
      ),
      node(12, [], node(13, [...u32(1), ...str('Thais'), ...u16(1), ...u16(2), 7]), node(0x33)),
      node(15, [], node(16, [...str('wp'), ...u16(3), ...u16(4), 5]))
    ),
    node(AREA, [...u16(0), ...u16(0), 6], node(TILE, [1, 1]))
  ),
  [0xff]
)

describe('OtbmDocument', () => {
  const otbm = Otbm()

  it('writes back byte for byte every feature of the Shape', () => {
    expect(otbm.write(otbm.load(full))).toEqual(full)
  })

  it('replays exactly the events it was built from', () => {
    const fromFile = recorder()
    readOtbm(full, fromFile.visitor)
    const fromDocument = recorder()
    drain(otbm.load(full), fromDocument.visitor)
    expect(fromDocument.events).toEqual(fromFile.events)
  })

  it('keeps root children before and after the map data, and the diagnostics', () => {
    const document = otbm.load(full)
    expect(document.beforeMapData).toMatchObject([{ kind: 'unknown', type: 0x30 }])
    expect(document.afterMapData).toMatchObject([{ kind: 'area', x: 0, y: 0, z: 6 }])
    expect(document.trailing).toEqual(Uint8Array.of(0xff))
    expect(document.diagnostics.map((d) => d.code)).toContain('node-out-of-place')
  })

  it('finds tiles by position and counts areas, tiles and items', () => {
    const document = otbm.load(full)
    const tile = document.getTile(256, 256, 7)
    expect(tile).toMatchObject({ flags: 8, houseId: null, tail: Uint8Array.of(0x77) })
    expect(tile?.items.map((item) => (item.kind === 'item' ? item.sid : item.type))).toEqual([
      4526, 1987
    ])
    expect(document.getTile(259, 260, 7)?.items).toEqual([])
    expect(document.getTile(1, 1, 7)).toBeUndefined()
    expect(document.stats()).toEqual({ areas: 2, tiles: 3, items: 3 })
  })

  it('writes an edited attribute and nothing else differently', () => {
    const before = mapBytes([
      node(
        AREA,
        [...u16(0), ...u16(0), 7],
        node(TILE, [0, 0], node(ITEM, [...u16(1987), 0x04, ...u16(5)]))
      )
    ])
    const document = otbm.load(before)
    const item = document.getTile(0, 0, 7)!.items[0] as OtbmDocumentItem
    item.attributes = [{ kind: 'actionId', value: 6 }]
    const after = otbm.write(document)
    const changed = [...after].flatMap((b, i) => (b === before[i] ? [] : [i]))
    expect(after.length).toBe(before.length)
    expect(changed).toHaveLength(1)
    expect(after[changed[0]!]).toBe(6)
  })

  it('refuses events that do not describe a whole map', () => {
    const collector = collectDocument()
    collector.visitor.header?.({
      identifier: 0,
      version: 2,
      width: 1,
      height: 1,
      otbMajor: 0,
      otbMinor: 0,
      rootType: 0,
      tail: null
    })
    expect(() => collector.document()).toThrow(/complete map/)
  })
})
