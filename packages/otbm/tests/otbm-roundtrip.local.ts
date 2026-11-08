import { describe, expect, it } from 'vitest'
import { Otbm } from '../src/otbm.js'
import type { OtbmDiagnostic } from '../src/types.js'
import { firstDifference, loadMap, presentMaps } from './support/otbm-fixtures.js'

describe('every fixture: reader counts, diagnostics and byte-identical roundtrip', () => {
  for (const map of presentMaps()) {
    it(
      map.id,
      () => {
        const { bytes, options } = loadMap(map)
        const otbm = Otbm(options)
        let tiles = 0
        const warnings: OtbmDiagnostic[] = []
        otbm.read(bytes, {
          tile: () => void tiles++,
          diagnostic: (d) => {
            if (d.code !== 'possible-utf8-text' && d.code !== 'unknown-node') warnings.push(d)
          }
        })
        expect(tiles).toBe(map.scan?.tiles)
        const isMalformedAtSource = map.id.startsWith('large-small-areas')
        if (isMalformedAtSource) {
          expect(new Set(warnings.map((w) => w.code))).toEqual(
            new Set([
              'area-properties-extra',
              'tile-outside-area',
              'node-out-of-place',
              'trailing-bytes'
            ])
          )
        } else {
          expect(warnings).toEqual([])
        }
        expect(firstDifference(otbm.write(otbm.source(bytes)), bytes)).toBe(-1)
      },
      120_000
    )
  }
})
