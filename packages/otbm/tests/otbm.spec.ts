import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { ParseError } from '@paradox/utils'
import type { OtbmFile } from '../src/types.js'
import { Otbm } from '../src/otbm.js'

const FIXTURES = join(import.meta.dirname, '../fixtures')

function load(name: string): Uint8Array {
  const buf = readFileSync(join(FIXTURES, name))
  return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)
}

describe('small-v1.fixture.otbm', () => {
  const arr = load('small-v1.fixture.otbm')
  let file: OtbmFile

  beforeAll(() => {
    file = Otbm().load(arr)
  }, 15_000)

  it('validate() does not throw', () => {
    expect(() => Otbm().validate(arr)).not.toThrow()
  })

  it('header: version=1, width=1000, height=1000', () => {
    expect(file.header.version).toBe(1)
    expect(file.header.width).toBe(1000)
    expect(file.header.height).toBe(1000)
  })

  it('getStats(): tiles=271484, houseTiles=608, items=368625, towns=2', () => {
    const s = file.getStats()
    expect(s.tiles).toBe(271_484)
    expect(s.houseTiles).toBe(608)
    expect(s.items).toBe(368_625)
    expect(s.towns).toBe(2)
  })

  it("towns[0]: name='Principal', x=555, y=414, z=8", () => {
    const town = file.towns[0]!
    expect(town.name).toBe('Principal')
    expect(town.x).toBe(555)
    expect(town.y).toBe(414)
    expect(town.z).toBe(8)
  })

  it('waypoints returns []', () => {
    expect(file.waypoints).toHaveLength(0)
  })
})

describe('oldmap-v0.fixture.otbm', () => {
  const arr = load('oldmap-v0.fixture.otbm')
  const lookup = { getBySid: (sid: number) => ({ cid: sid }) }
  let file: OtbmFile

  beforeAll(() => {
    file = Otbm({ lookup }).load(arr)
  }, 10_000)

  it('validate() does not throw', () => {
    expect(() => Otbm().validate(arr)).not.toThrow()
  })

  it('load() without OtbLookup throws ParseError (v0 requires lookup)', () => {
    expect(() => Otbm().load(arr)).toThrow(ParseError)
  })

  it('header: version=0, width=1000, height=1000', () => {
    expect(file.header.version).toBe(0)
    expect(file.header.width).toBe(1000)
    expect(file.header.height).toBe(1000)
  })

  it('getStats(): tiles=62382, houseTiles=0, items=75352, towns=1', () => {
    const s = file.getStats()
    expect(s.tiles).toBe(62_382)
    expect(s.houseTiles).toBe(0)
    expect(s.items).toBe(75_352)
    expect(s.towns).toBe(1)
  })

  it("towns[0]: name='RuaB', x=509, y=472, z=6", () => {
    const town = file.towns[0]!
    expect(town.name).toBe('RuaB')
    expect(town.x).toBe(509)
    expect(town.y).toBe(472)
    expect(town.z).toBe(6)
  })

  it('v0 items have cid resolved via lookup', () => {
    const sample = file.areas[0]!.tiles[0]!.items[0]
    expect(sample).toBeDefined()
    expect(sample!.cid).toBe(sample!.sid)
  })

  it('waypoints returns [] (v0)', () => {
    expect(file.waypoints).toHaveLength(0)
  })
})
