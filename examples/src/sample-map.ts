import { Otbm } from '@paradoxlab/otbm'
import type { OtbmSource } from '@paradoxlab/otbm'

/**
 * A small OTBM v3 map built from events: one area with grounds, a backpack holding gold, a sign with
 * text, a house tile and two towns. Examples run against it when no map file is given.
 */
export function sampleMap(): Uint8Array {
  const source: OtbmSource = {
    *emit(visitor) {
      visitor.header?.({
        identifier: 0,
        version: 2,
        width: 1024,
        height: 1024,
        otbMajor: 3,
        otbMinor: 57,
        rootType: 0,
        tail: null
      })
      visitor.mapData?.({ attributes: [{ kind: 'description', value: 'Sample map' }] })
      visitor.area?.(256, 256, 7, null)
      for (let x = 0; x < 4; x++) {
        visitor.tile?.(256 + x, 256, 7, null, null, null)
        visitor.item?.(4526, 'inline', null)
        visitor.itemEnd?.()
        visitor.tileEnd?.()
      }
      visitor.tile?.(256, 257, 7, null, null, null)
      visitor.item?.(4526, 'inline', null)
      visitor.itemEnd?.()
      visitor.item?.(1988, 'node', [{ kind: 'actionId', value: 1001 }])
      visitor.item?.(2148, 'node', [{ kind: 'count', value: 100 }])
      visitor.itemEnd?.()
      visitor.itemEnd?.()
      visitor.item?.(1814, 'node', [{ kind: 'text', value: 'Welcome to the temple’s gate…' }])
      visitor.itemEnd?.()
      visitor.tileEnd?.()
      visitor.tile?.(257, 257, 7, 0x01, 42, null)
      visitor.item?.(4526, 'inline', null)
      visitor.itemEnd?.()
      visitor.tileEnd?.()
      visitor.areaEnd?.()
      yield
      visitor.list?.('towns')
      visitor.town?.({ id: 1, name: 'Thais', x: 256, y: 256, z: 7, tail: null })
      visitor.town?.({ id: 2, name: 'Carlin', x: 260, y: 256, z: 7, tail: null })
      visitor.listEnd?.()
      visitor.mapDataEnd?.()
      visitor.end?.(null)
    }
  }
  return Otbm().write(source)
}
