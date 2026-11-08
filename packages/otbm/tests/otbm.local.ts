import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { ParseError } from '@paradoxlab/utils'
import type { OtbmFile } from '../src/types.js'
import { Otbm } from '../src/otbm.js'

const FIXTURES = join(import.meta.dirname, '../../../fixtures/maps')

function load(name: string) {
  const buf = readFileSync(join(FIXTURES, name))
  return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)
}

const mediumV2Path = join(FIXTURES, 'large-small-areas-otbm3-otb3-20.otbm')
describe.skipIf(!existsSync(mediumV2Path))('large-small-areas-otbm3-otb3-20.otbm', () => {
  let file: OtbmFile

  beforeAll(() => {
    file = Otbm().load(load('large-small-areas-otbm3-otb3-20.otbm'))
  }, 30_000)

  it('validate() does not throw', () => {
    expect(() => Otbm().validate(load('large-small-areas-otbm3-otb3-20.otbm'))).not.toThrow()
  })

  it('header: version=2, width=4000, height=4000', () => {
    expect(file.header.version).toBe(2)
    expect(file.header.width).toBe(4000)
    expect(file.header.height).toBe(4000)
  })

  it('getStats(): tiles=3342051, houseTiles=6005, items=4354448, towns=5', () => {
    const s = file.getStats()
    expect(s.tiles).toBe(3_342_051)
    expect(s.houseTiles).toBe(6_005)
    expect(s.items).toBe(4_354_448)
    expect(s.towns).toBe(5)
  })

  it("towns[0]: name='Arcania', x=165, y=46, z=7", () => {
    const town = file.towns[0]!
    expect(town.name).toBe('Arcania')
    expect(town.x).toBe(165)
    expect(town.y).toBe(46)
    expect(town.z).toBe(7)
  })

  it('waypoints is empty', () => {
    expect(file.waypoints).toHaveLength(0)
  })
})

const mediumV1Path = join(FIXTURES, 'medium-reference-otbm2-otb3-15.otbm')
describe.skipIf(!existsSync(mediumV1Path))('medium-reference-otbm2-otb3-15.otbm', () => {
  let file: OtbmFile

  beforeAll(() => {
    file = Otbm().load(load('medium-reference-otbm2-otb3-15.otbm'))
  }, 20_000)

  it('validate() does not throw', () => {
    expect(() => Otbm().validate(load('medium-reference-otbm2-otb3-15.otbm'))).not.toThrow()
  })

  it('header: version=1, width=3000, height=3000', () => {
    expect(file.header.version).toBe(1)
    expect(file.header.width).toBe(3000)
    expect(file.header.height).toBe(3000)
  })

  it('getStats(): tiles=1073788, houseTiles=0, items=1348935, nestedItems=113', () => {
    const s = file.getStats()
    expect(s.tiles).toBe(1_073_788)
    expect(s.houseTiles).toBe(0)
    expect(s.items).toBe(1_348_935)
    expect(s.nestedItems).toBe(113)
  })

  it('waypoints is empty', () => {
    expect(file.waypoints).toHaveLength(0)
  })
})

const largeV0Path = join(FIXTURES, 'small-wide-otbm1-otb1-3.otbm')
describe.skipIf(!existsSync(largeV0Path))('small-wide-otbm1-otb1-3.otbm', () => {
  const lookup = { getBySid: (sid: number) => ({ cid: sid }) }
  let file: OtbmFile

  beforeAll(() => {
    file = Otbm({ lookup }).load(load('small-wide-otbm1-otb1-3.otbm'))
  }, 15_000)

  it('validate() does not throw', () => {
    expect(() => Otbm().validate(load('small-wide-otbm1-otb1-3.otbm'))).not.toThrow()
  })

  it('load() without OtbLookup throws ParseError (v0 requires lookup)', () => {
    expect(() => Otbm().load(load('small-wide-otbm1-otb1-3.otbm'))).toThrow(ParseError)
  })

  it('header: version=0, width=5000, height=5000', () => {
    expect(file.header.version).toBe(0)
    expect(file.header.width).toBe(5000)
    expect(file.header.height).toBe(5000)
  })

  it('getStats(): tiles=461023, houseTiles=0, items=513522, towns=3', () => {
    const s = file.getStats()
    expect(s.tiles).toBe(461_023)
    expect(s.houseTiles).toBe(0)
    expect(s.items).toBe(513_522)
    expect(s.towns).toBe(3)
  })

  it('towns has 3 entries: Humans, Elven, Dwarven', () => {
    const towns = file.towns
    expect(towns).toHaveLength(3)
    expect(towns[0]!.name).toBe('Humans')
    expect(towns[1]!.name).toBe('Elven')
    expect(towns[2]!.name).toBe('Dwarven')
  })

  it('towns[0]: x=2587, y=2400, z=6', () => {
    const town = file.towns[0]!
    expect(town.x).toBe(2587)
    expect(town.y).toBe(2400)
    expect(town.z).toBe(6)
  })

  it('waypoints is empty', () => {
    expect(file.waypoints).toHaveLength(0)
  })
})

const xlargeV1Path = join(FIXTURES, 'xlarge-stress-otbm2-otb3-15.otbm')
describe.skipIf(!existsSync(xlargeV1Path))('xlarge-stress-otbm2-otb3-15.otbm', () => {
  let file: OtbmFile

  beforeAll(() => {
    file = Otbm().load(load('xlarge-stress-otbm2-otb3-15.otbm'))
  }, 60_000)

  it('validate() does not throw', () => {
    expect(() => Otbm().validate(load('xlarge-stress-otbm2-otb3-15.otbm'))).not.toThrow()
  })

  it('header: version=1, width=65535, height=65535', () => {
    expect(file.header.version).toBe(1)
    expect(file.header.width).toBe(65535)
    expect(file.header.height).toBe(65535)
  })

  it('getStats(): tiles=7835011, houseTiles=0, items=8602187, towns=10', () => {
    const s = file.getStats()
    expect(s.tiles).toBe(7_835_011)
    expect(s.houseTiles).toBe(0)
    expect(s.items).toBe(8_602_187)
    expect(s.towns).toBe(10)
  })

  it('towns[0]: name="Ab\'dendriel", x=32732, y=31634, z=7', () => {
    const town = file.towns[0]!
    expect(town.name).toBe("Ab'dendriel")
    expect(town.x).toBe(32_732)
    expect(town.y).toBe(31_634)
    expect(town.z).toBe(7)
  })

  it('waypoints is empty', () => {
    expect(file.waypoints).toHaveLength(0)
  })
})
