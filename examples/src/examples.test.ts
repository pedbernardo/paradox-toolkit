import { describe, expect, it } from 'vitest'
import { Otbm, compareOtbm } from '@paradoxlab/otbm'
import { addTileWithComposer } from './otbm-compose.js'
import { suggestCodec } from './otbm-detect-codec.js'
import { setActionId } from './otbm-edit.js'
import { otbmStats } from './otbm-stats.js'
import { upgradeToV3 } from './otbm-upgrade.js'
import { sampleMap } from './sample-map.js'

const map = sampleMap()

describe('examples run against the sample map', () => {
  it('otbm-stats counts tiles, items and towns', () => {
    expect(otbmStats(map)).toEqual({
      version: 'OTBM v3, OTB 3.57',
      tiles: 6,
      houseTiles: 1,
      items: 9,
      towns: ['Thais', 'Carlin']
    })
  })

  it('otbm-upgrade streams a map that means the same', () => {
    const chunks = upgradeToV3(map)
    const out = Uint8Array.from(chunks.flatMap((chunk) => [...chunk]))
    const otbm = Otbm()
    expect(compareOtbm(otbm.load(map), otbm.load(out))).toEqual([])
  })

  it('otbm-edit changes one item and nothing else', () => {
    const { bytes, changed } = setActionId(map, 1988, 2000)
    expect(changed).toBe(1)
    const differences = compareOtbm(Otbm().load(map), Otbm().load(bytes))
    expect(differences.map((d) => d.path)).toEqual(['tile 256,257,7 item 1 attributes'])
  })

  it('otbm-compose writes the original bytes plus the new tile', () => {
    const out = addTileWithComposer(map)
    const differences = compareOtbm(Otbm().load(map), Otbm().load(out))
    expect(differences.map((d) => d.path)).toEqual(['tile 300,300,7'])
  })

  it('otbm-detect-codec suggests windows-1252 for the sample text', () => {
    const suggestion = suggestCodec(map)
    expect(suggestion.codec.name).toBe('windows-1252')
    expect(suggestion.samples).toContain('Welcome to the temple’s gate…')
  })
})
