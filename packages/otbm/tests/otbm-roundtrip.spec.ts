import { describe, expect, it } from 'vitest'
import { Otbm } from '../src/otbm.js'
import { firstDifference, loadMap, publicMaps } from './support/otbm-fixtures.js'

describe('public fixtures: byte-identical roundtrip', () => {
  const maps = publicMaps()

  it('has the two public fixtures', () => {
    expect(maps.map((map) => map.id).sort()).toEqual([
      'small-houses-spawns-otbm2-otb3-19',
      'small-legacy-otbm1-otb2-unk'
    ])
  })

  for (const map of maps) {
    it(
      map.id,
      () => {
        const { bytes, options } = loadMap(map)
        const otbm = Otbm(options)
        let tiles = 0
        otbm.read(bytes, { tile: () => void tiles++ })
        expect(tiles).toBe(map.scan?.tiles)
        expect(firstDifference(otbm.write(otbm.source(bytes)), bytes)).toBe(-1)
      },
      30_000
    )
  }
})
