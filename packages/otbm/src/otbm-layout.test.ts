import { describe, expect, it } from 'vitest'
import { Otbm } from './otbm.js'
import { collectDocument } from './otbm-document.js'
import { collectSourceLayout, composeOtbm } from './otbm-layout.js'
import { headerProps, node, otbmBytes, str, u16, u32 } from '../tests/support/otbm-bytes.js'
import { documentTileSource } from '../tests/support/otbm-recorder.js'
import type { OtbmDocumentTile, SourceLayout } from './types.js'

const AREA = 4
const TILE = 5
const ITEM = 6
const tileAt = (dx: number, dy: number, sid = 100) => node(TILE, [dx, dy], node(ITEM, u16(sid)))

// Two areas with tiles in a non-canonical order (x outer, y inner), an unknown node among the tiles,
// towns, an unknown map data child, and an empty area that must be kept.
const source = otbmBytes(
  node(
    1,
    headerProps(2, 1024, 1024),
    node(
      2,
      [1, ...str('m')],
      node(
        AREA,
        [...u16(256), ...u16(0), 7],
        tileAt(1, 0),
        tileAt(0, 1),
        node(0x30, [1]),
        tileAt(0, 0)
      ),
      node(AREA, [...u16(0), ...u16(0), 7]),
      node(AREA, [...u16(0), ...u16(256), 6], tileAt(5, 5, 200)),
      node(12, [], node(13, [...u32(1), ...str('Thais'), ...u16(1), ...u16(2), 7])),
      node(3, [9])
    )
  )
)

function prepare(bytes: Uint8Array): {
  layout: SourceLayout
  tiles: ReturnType<typeof documentTileSource>
} {
  const layout = collectSourceLayout()
  const document = collectDocument()
  Otbm().read(bytes, [layout.visitor, document.visitor])
  return { layout: layout.layout(), tiles: documentTileSource(document.document()) }
}

const write = (
  bytes: Uint8Array,
  edit?: (tiles: Map<string, OtbmDocumentTile>) => void,
  options = {}
) => {
  const { layout, tiles } = prepare(bytes)
  edit?.(tiles.tiles)
  return Otbm().write(composeOtbm(layout, tiles, options))
}

const tilesOf = (bytes: Uint8Array) => {
  const positions: string[] = []
  Otbm().read(bytes, { tile: (x, y, z) => void positions.push(`${x},${y},${z}`) })
  return positions
}

describe('composeOtbm', () => {
  it('writes an unedited map byte for byte', () => {
    expect(write(source)).toEqual(source)
  })

  it('skips a deleted tile and keeps the others in their order', () => {
    const out = write(source, (tiles) => tiles.delete('256,1,7'))
    expect(tilesOf(out)).toEqual(['257,0,7', '256,0,7', '5,261,6'])
  })

  it('drops an area whose tiles were all deleted, and keeps an area that was empty already', () => {
    const out = write(source, (tiles) => tiles.delete('5,261,6'))
    const areas: string[] = []
    Otbm().read(out, { area: (x, y, z) => void areas.push(`${x},${y},${z}`) })
    expect(areas).toEqual(['256,0,7', '0,0,7'])
  })

  it('writes new tiles after the last original area, in canonical areas', () => {
    const out = write(source, (tiles) => {
      const template = tiles.get('256,0,7')!
      tiles.set('600,10,7', { ...template, x: 600, y: 10 })
      tiles.set('300,5,7', { ...template, x: 300, y: 5 })
      tiles.set('2,3,5', { ...template, x: 2, y: 3, z: 5 })
    })
    const events: string[] = []
    Otbm().read(out, {
      area: (x, y, z) => void events.push(`area ${x},${y},${z}`),
      tile: (x, y, z) => void events.push(`tile ${x},${y},${z}`),
      list: () => void events.push('list')
    })
    expect(events.slice(-8)).toEqual([
      'tile 5,261,6',
      'area 0,0,5',
      'tile 2,3,5',
      'area 256,0,7',
      'tile 300,5,7',
      'area 512,0,7',
      'tile 600,10,7',
      'list'
    ])
  })

  it('replaces towns when the consumer gives them', () => {
    const out = write(source, undefined, {
      towns: [{ id: 2, name: 'Carlin', x: 5, y: 6, z: 7, tail: null }]
    })
    const towns: string[] = []
    Otbm().read(out, { town: (town) => void towns.push(town.name) })
    expect(towns).toEqual(['Carlin'])
  })

  it('writes every tile in canonical areas when asked', () => {
    const out = write(source, undefined, { layout: 'canonical' })
    expect(tilesOf(out)).toEqual(['5,261,6', '256,0,7', '257,0,7', '256,1,7'])
  })

  it('places new tiles at the end of the map data when there was no area', () => {
    const empty = otbmBytes(node(0, headerProps(), node(2, [], node(12))))
    const { layout } = prepare(empty)
    const { tiles } = prepare(source)
    const events: string[] = []
    Otbm().read(Otbm().write(composeOtbm(layout, tiles)), {
      area: () => void events.push('area'),
      list: () => void events.push('list')
    })
    expect(events).toEqual(['list', 'area', 'area'])
  })
})

describe('read with several visitors', () => {
  it('calls every visitor in order with the same arguments', () => {
    const calls: string[] = []
    Otbm().read(source, [
      { tile: (x) => void calls.push(`a${x}`) },
      { tile: (x) => void calls.push(`b${x}`), header: () => void calls.push('header') }
    ])
    expect(calls.slice(0, 3)).toEqual(['header', 'a257', 'b257'])
  })
})

describe('collectSourceLayout', () => {
  it('refuses an incomplete map', () => {
    const layout = collectSourceLayout()
    expect(() => layout.layout()).toThrow(/complete map/)
  })
})
