import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ManifestError, createFixtures, parseManifest, scanOtbm } from './index.js'

const base = {
  schema: 1,
  items: { 'otb1-3': { path: 'items/a.otb', bytes: 1, version: 'OTB 1.3' } },
  clients: {
    '772': { dat: { path: 'client/a.dat', bytes: 1 }, spr: { path: 'client/a.spr', bytes: 1 } }
  },
  maps: [
    {
      id: 'small-a',
      purpose: 'test',
      otbm: 1,
      items: 'otb1-3',
      client: '772',
      tags: [],
      public: true,
      map: { path: 'maps/a.otbm', bytes: 1 }
    }
  ]
}

describe('parseManifest', () => {
  it('accepts a valid manifest', () => {
    expect(parseManifest(base).maps[0]?.id).toBe('small-a')
  })

  it('rejects unknown references and duplicates', () => {
    const unknownItems = { ...base, maps: [{ ...base.maps[0], items: 'nope' }] }
    expect(() => parseManifest(unknownItems)).toThrow(ManifestError)
    const duplicate = { ...base, maps: [base.maps[0], base.maps[0]] }
    expect(() => parseManifest(duplicate)).toThrow(/duplicate id/)
  })

  it('validates the scan block when present', () => {
    const badScan = { ...base, maps: [{ ...base.maps[0], scan: { tiles: 'x' } }] }
    expect(() => parseManifest(badScan)).toThrow(ManifestError)
  })
})

describe('createFixtures', () => {
  it('hands out only files present on disk, never throwing for missing ones', () => {
    const root = mkdtempSync(join(tmpdir(), 'fixtures-'))
    writeFileSync(join(root, 'manifest.json'), JSON.stringify(base))
    const fx = createFixtures(root)
    expect(fx.mapFixture('small-a')).toBeUndefined()
    expect(fx.mapFixture('unknown')).toBeUndefined()
    expect(fx.presentMaps()).toEqual([])

    mkdirSync(join(root, 'maps'))
    writeFileSync(join(root, 'maps/a.otbm'), 'x')
    const map = fx.mapFixture('small-a')
    expect(map?.map.absolute).toBe(join(root, 'maps/a.otbm'))
    expect(map?.itemsFile).toBeUndefined()
    expect(map?.datFile).toBeUndefined()
  })

  it('resolves every id of the repository manifest', () => {
    const fx = createFixtures()
    for (const map of fx.manifest.maps) {
      expect(() => fx.mapFixture(map.id)).not.toThrow()
    }
  })
})

describe('scanOtbm', () => {
  it('counts nodes, escapes and stray tiles from bytes alone', () => {
    // root { map data { area { tile { item { item } } } , tile outside area } }
    const bytes = Uint8Array.from([
      0, 0, 0, 0, 0xfe, 0x00, 0x01, 0xfd, 0xfe, 0xfe, 0x02, 0xfe, 0x04, 1, 2, 3, 4, 5, 0xfe, 0x05,
      0, 0, 0xfe, 0x06, 1, 0, 0xfe, 0x06, 2, 0, 0xff, 0xff, 0xff, 0xff, 0xfe, 0x05, 1, 1, 0xff,
      0xff, 0xff
    ])
    const scan = scanOtbm(bytes)
    expect(scan).toMatchObject({
      tiles: 1,
      strayTiles: 1,
      itemNodes: 2,
      areas: 1,
      maxItemNesting: 2,
      maxItemNodesPerTile: 1,
      maxContainerChildren: 1,
      maxNodeProps: 5
    })
  })
})
