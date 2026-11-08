import { describe, expect, it } from 'vitest'
import { loadPack } from '@paradoxlab/backpack/load'
import { Otbm, compareOtbm } from '@paradoxlab/otbm'
import { addTileWithComposer } from './otbm-compose.js'
import { buildAssetPack } from './pack-build.js'
import { drawStack } from './pack-load.js'
import { sampleClient } from './sample-client.js'
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

describe('pack examples run against the sample client', () => {
  const memoryReader = (files: Awaited<ReturnType<typeof buildAssetPack>>) => {
    const json: Record<string, string> = {
      'pack.json': JSON.stringify(files.manifest),
      'items.json': JSON.stringify(files.items),
      'render.json': JSON.stringify(files.render)
    }
    return async (path: string) => new TextEncoder().encode(json[path])
  }

  it('pack-build makes one item per sid and one page', async () => {
    const files = await buildAssetPack(sampleClient())
    expect(files.manifest.counts).toEqual({ items: 2, appearances: 2, frames: 9 })
    expect(files.pages).toHaveLength(1)
  })

  it('pack-load finds the frame for a stack of 7 gold coins', async () => {
    const pack = await loadPack(memoryReader(await buildAssetPack(sampleClient())))
    // 7 coins use the "5 to 9" pattern: sprite 5, a 20x20 square in the bottom-right corner.
    expect(drawStack(pack, 2148, 7)).toMatchObject({
      page: 0,
      source: { w: 20, h: 20 },
      at: { x: 12, y: 12 }
    })
    expect(drawStack(pack, 2148, 1)!.source.w).toBe(4)
    expect(drawStack(pack, 102, 1)!.source.w).toBe(32)
    expect(drawStack(pack, 9999, 1)).toBeUndefined()
  })
})
