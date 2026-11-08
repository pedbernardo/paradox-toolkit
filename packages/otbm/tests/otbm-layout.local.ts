import { describe, expect, it } from 'vitest'
import { Otbm } from '../src/otbm.js'
import { collectDocument } from '../src/otbm-document.js'
import { collectSourceLayout, composeOtbm } from '../src/otbm-layout.js'
import { documentTileSource } from './support/otbm-recorder.js'
import { firstDifference, loadMap, presentMaps } from './support/otbm-fixtures.js'

describe('every fixture: Source layout + tile source + composer is byte-identical', () => {
  for (const map of presentMaps()) {
    it(
      map.id,
      () => {
        const { bytes, options } = loadMap(map)
        const otbm = Otbm(options)
        const layout = collectSourceLayout()
        const document = collectDocument()
        otbm.read(bytes, [layout.visitor, document.visitor])
        const tiles = documentTileSource(document.document())
        const out = otbm.write(composeOtbm(layout.layout(), tiles))
        expect(firstDifference(out, bytes)).toBe(-1)
      },
      300_000
    )
  }
})
