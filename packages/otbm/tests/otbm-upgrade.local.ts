import { describe, expect, it } from 'vitest'
import { Otbm } from '../src/otbm.js'
import { compareOtbm } from '../src/otbm-compare.js'
import { upgradeOtbm } from '../src/otbm-upgrade.js'
import { loadMap, presentMaps } from './support/otbm-fixtures.js'

describe('OTBM v1 fixtures upgraded to v3 mean the same', () => {
  for (const map of presentMaps().filter((m) => m.otbm === 1)) {
    it(
      map.id,
      () => {
        const { bytes, options } = loadMap(map)
        const v1 = Otbm(options)
        const v3Bytes = v1.write(upgradeOtbm(v1.source(bytes), 3))
        const v3 = Otbm()
        expect(v3.load(v3Bytes).header.version).toBe(2)
        const differences = compareOtbm(v1.load(bytes), v3.load(v3Bytes))
        expect(differences.filter((d) => d.path !== 'header version')).toEqual([])
      },
      120_000
    )
  }
})
