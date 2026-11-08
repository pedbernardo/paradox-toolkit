import { describe, expect, it } from 'vitest'
import { Otbm } from '../src/otbm.js'
import { firstDifference, loadMap, presentMaps } from './support/otbm-fixtures.js'

describe('every fixture: write(load(bytes)) is byte-identical', () => {
  for (const map of presentMaps()) {
    it(
      map.id,
      () => {
        const { bytes, options } = loadMap(map)
        const otbm = Otbm(options)
        const document = otbm.load(bytes)
        expect(document.stats().tiles).toBe(map.scan?.tiles)
        expect(firstDifference(otbm.write(document), bytes)).toBe(-1)
      },
      300_000
    )
  }
})
