import { describe, it, expect } from 'vitest'
import type { Thing, ThingLayout, DatFile } from '@paradoxlab/dat'
import type { OtbItem, OtbFile, OtbItemFlags } from '@paradoxlab/otb'
import { Thinger } from './thinger.js'

const defaultLayout: ThingLayout = {
  width: 1,
  height: 1,
  layers: 1,
  patternX: 1,
  patternY: 1,
  patternZ: 1,
  frames: 1,
  realSize: 32,
  exactSize: 32
}

const defaultOtbFlags: OtbItemFlags = {
  unpassable: false,
  blockMissiles: false,
  blockPathfinder: false,
  hasElevation: false,
  useable: false,
  pickupable: false,
  moveable: false,
  stackable: false,
  floorChangeDown: false,
  floorChangeNorth: false,
  floorChangeEast: false,
  floorChangeSouth: false,
  floorChangeWest: false,
  alwaysOnTop: false,
  readable: false,
  rotable: false,
  hangable: false,
  hookEast: false,
  hookSouth: false,
  cannotDecay: false,
  allowDistRead: false,
  clientDuration: false,
  clientCharges: false,
  ignoreLook: false,
  isAnimation: false,
  fullGround: false,
  forceUse: false
}

function makeDatFile(things: Thing[]): DatFile {
  return {
    version: 772,
    signature: 0,
    counts: { itemsMaxCid: 20000, creatures: 0, effects: 0, missiles: 0 },
    things,
    get: (group, index) => things.find((t) => t.group === group && t.cid === index),
    entries: () => things
  }
}

function makeOtbFile(items: OtbItem[]): OtbFile {
  const map = new Map(items.map((i) => [i.sid, i]))
  return {
    schemaVersion: '772',
    count: items.length,
    items,
    get: (sid) => map.get(sid),
    entries: function* () {
      yield* map.entries()
    }
  }
}

function makeThing(cid: number, group: Thing['group'] = 'items'): Thing {
  return { cid, group, flags: {}, layout: defaultLayout, spriteIds: [1] }
}

function makeOtbItem(cid: number, overrides: Partial<OtbItem> = {}): OtbItem {
  return {
    sid: cid,
    cid,
    group: 1,
    flags: { ...defaultOtbFlags },
    attributes: {},
    ...overrides
  }
}

describe('Thinger - gameplay from OTB entry', () => {
  it('uses OTB flags for walkable, blocksSight, groundSpeed, weight', () => {
    const thing = makeThing(100)
    const otbItem = makeOtbItem(100, {
      flags: { ...defaultOtbFlags, unpassable: true, blockMissiles: true, blockPathfinder: true },
      attributes: { speed: 200, weight: 5000 }
    })
    const { items } = Thinger({ dat: makeDatFile([thing]), otb: makeOtbFile([otbItem]) }).build()

    expect(items).toHaveLength(1)
    const [item] = items
    expect(item!.gameplay.walkable).toBe(false)
    expect(item!.gameplay.blocksSight).toBe(true)
    expect(item!.gameplay.blocksMissile).toBe(true)
    expect(item!.gameplay.blockPathfinder).toBe(true)
    expect(item!.gameplay.groundSpeed).toBe(200)
    expect(item!.gameplay.weight).toBe(5000)
  })
})

describe('Thinger - DAT fallback when no OTB entry', () => {
  it('uses DAT flags for walkable, blocksSight, blocksMissile', () => {
    const thing: Thing = {
      cid: 200,
      group: 'items',
      flags: { unpassable: true, blockMissiles: true },
      layout: defaultLayout,
      spriteIds: [1]
    }
    const { items } = Thinger({ dat: makeDatFile([thing]), otb: makeOtbFile([]) }).build()

    const [item] = items
    expect(item!.gameplay.walkable).toBe(false)
    expect(item!.gameplay.blocksSight).toBe(true)
    expect(item!.gameplay.blocksMissile).toBe(true)
  })
})

describe('Thinger - name resolution chain', () => {
  it('prefers OTB name', () => {
    const thing = makeThing(106)
    const otbItem = makeOtbItem(106, { attributes: { name: 'otb-grass' } })
    const { items } = Thinger({ dat: makeDatFile([thing]), otb: makeOtbFile([otbItem]) }).build()
    expect(items[0]!.name).toBe('otb-grass')
  })

  it('falls back to name-map when OTB name absent (cid 106 = grass)', () => {
    const thing = makeThing(106)
    const otbItem = makeOtbItem(106, { attributes: {} })
    const { items } = Thinger({ dat: makeDatFile([thing]), otb: makeOtbFile([otbItem]) }).build()
    expect(items[0]!.name).toBe('grass')
  })

  it('returns empty string when both OTB name and name-map absent', () => {
    const thing = makeThing(99999)
    const otbItem = makeOtbItem(99999, { attributes: {} })
    const { items } = Thinger({ dat: makeDatFile([thing]), otb: makeOtbFile([otbItem]) }).build()
    expect(items[0]!.name).toBe('')
  })
})

describe('Thinger - categorization', () => {
  it('routes things to correct output arrays by group', () => {
    const item = makeThing(100, 'items')
    const creature = makeThing(1, 'creatures')
    const effect = makeThing(1, 'effects')
    const missile = makeThing(1, 'missiles')

    const dat = makeDatFile([item, creature, effect, missile])
    const otb = makeOtbFile([makeOtbItem(100)])
    const result = Thinger({ dat, otb }).build()

    expect(result.items).toHaveLength(1)
    expect(result.creatures).toHaveLength(1)
    expect(result.effects).toHaveLength(1)
    expect(result.missiles).toHaveLength(1)
    expect(result.items[0]!.id).toBe(100)
    expect(result.creatures[0]!.id).toBe(1)
  })

  it('visual-only entries have no gameplay field', () => {
    const creature = makeThing(1, 'creatures')
    const dat = makeDatFile([creature])
    const otb = makeOtbFile([])
    const { creatures } = Thinger({ dat, otb }).build()

    const [c] = creatures
    expect(c).toBeDefined()
    expect(c!.id).toBe(1)
    expect('gameplay' in c!).toBe(false)
    expect(c!.visual.spriteIds).toEqual([1])
  })
})

describe('Thinger - meta block', () => {
  it('meta.schema is "1.0.0"', () => {
    const dat = makeDatFile([makeThing(100)])
    const { meta } = Thinger({ dat, otb: makeOtbFile([]) }).build()
    expect(meta.schema).toBe('1.0.0')
  })

  it('meta.version matches dat.version', () => {
    const dat = makeDatFile([makeThing(100)])
    const { meta } = Thinger({ dat, otb: makeOtbFile([]) }).build()
    expect(meta.version).toBe(772)
  })

  it('meta.dat is hex string of dat.signature (8 chars, uppercase)', () => {
    const dat = makeDatFile([makeThing(100)])
    const { meta } = Thinger({ dat, otb: makeOtbFile([]) }).build()
    expect(meta.dat).toMatch(/^[0-9A-F]{8}$/)
  })

  it('meta.otb matches otb.schemaVersion', () => {
    const dat = makeDatFile([makeThing(100)])
    const otb = makeOtbFile([makeOtbItem(100)])
    const { meta } = Thinger({ dat, otb }).build()
    expect(meta.otb).toBe('772')
  })

  it('meta.counts reflects actual array lengths', () => {
    const item = makeThing(100, 'items')
    const creature = makeThing(1, 'creatures')
    const effect = makeThing(1, 'effects')
    const missile = makeThing(1, 'missiles')
    const dat = makeDatFile([item, creature, effect, missile])
    const otb = makeOtbFile([makeOtbItem(100)])
    const { meta } = Thinger({ dat, otb }).build()
    expect(meta.counts).toEqual({ items: 1, creatures: 1, effects: 1, missiles: 1 })
  })
})

describe('Thinger - no undefined in output', () => {
  it('all gameplay fields are defined for item with OTB entry', () => {
    const thing = makeThing(100)
    const otbItem = makeOtbItem(100)
    const { items } = Thinger({ dat: makeDatFile([thing]), otb: makeOtbFile([otbItem]) }).build()

    const [item] = items
    expect(item).toBeDefined()
    for (const [key, value] of Object.entries(item!.gameplay)) {
      expect(value, `gameplay.${key} should not be undefined`).not.toBeUndefined()
    }
    for (const [key, value] of Object.entries(item!.visual)) {
      expect(value, `visual.${key} should not be undefined`).not.toBeUndefined()
    }
  })
})
