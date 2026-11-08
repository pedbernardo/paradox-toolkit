import { describe, expect, it } from 'vitest'
import type { DatFile, Thing, ThingFlags } from '@paradoxlab/dat'
import type { OtbFile, OtbItem, OtbItemFlags } from '@paradoxlab/otb'
import { AppearanceFlag, FloorChange, ItemFlag, StackOrder } from './backpack-flags.js'
import { buildContent } from './backpack-content.js'

const layout = {
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

const thing = (cid: number, flags: ThingFlags = {}, group: Thing['group'] = 'items'): Thing => ({
  cid,
  group,
  flags,
  layout,
  spriteIds: [cid * 10, cid * 10 + 1]
})

function datOf(things: Thing[]): DatFile {
  return {
    version: 860,
    signature: 0x4c2c7993,
    counts: { itemsMaxCid: 0, creatures: 0, effects: 0, missiles: 0 },
    things,
    get: () => undefined,
    entries: () => things
  }
}

const FLAG_NAMES = [
  'unpassable',
  'blockMissiles',
  'blockPathfinder',
  'hasElevation',
  'useable',
  'pickupable',
  'moveable',
  'stackable',
  'floorChangeDown',
  'floorChangeNorth',
  'floorChangeEast',
  'floorChangeSouth',
  'floorChangeWest',
  'alwaysOnTop',
  'readable',
  'rotable',
  'hangable',
  'hookEast',
  'hookSouth',
  'cannotDecay',
  'allowDistRead',
  'clientDuration',
  'clientCharges',
  'ignoreLook',
  'isAnimation',
  'fullGround',
  'forceUse'
]
const NO_FLAGS = Object.fromEntries(FLAG_NAMES.map((name) => [name, false])) as OtbItemFlags

const otbItem = (
  sid: number,
  cid: number,
  flags: Partial<OtbItemFlags> = {},
  attributes: OtbItem['attributes'] = {}
): OtbItem => ({ sid, cid, group: 0, flags: { ...NO_FLAGS, ...flags }, attributes })

function otbOf(items: OtbItem[]): OtbFile {
  return {
    schemaVersion: '3.20.62',
    count: items.length,
    items,
    get: (sid) => items.find((item) => item.sid === sid),
    entries: () => items.map((item) => [item.sid, item] as [number, OtbItem])
  }
}

describe('buildContent', () => {
  it('makes one item per OTB entry, and sids sharing a cid share its appearance', () => {
    const content = buildContent({
      dat: datOf([thing(100), thing(101)]),
      otb: otbOf([otbItem(2000, 100), otbItem(2001, 100), otbItem(2002, 101)])
    })
    expect(content.items.sid).toEqual([2000, 2001, 2002])
    expect(content.items.cid).toEqual([100, 100, 101])
    expect(content.items.appearance).toEqual([0, 0, 1])
    expect(content.appearances.cid).toEqual([100, 101])
  })

  it('never makes up a sid for a client thing without an OTB entry', () => {
    const content = buildContent({
      dat: datOf([thing(100), thing(555)]),
      otb: otbOf([otbItem(2000, 100)])
    })
    expect(content.items.sid).toEqual([2000])
    expect(content.appearances.cid).toEqual([100, 555])
  })

  it('points an OTB item whose cid the client lacks at no appearance', () => {
    const content = buildContent({ dat: datOf([thing(100)]), otb: otbOf([otbItem(2000, 999)]) })
    expect(content.items.appearance).toEqual([-1])
  })

  it('declares sid = cid when there is no OTB', () => {
    const content = buildContent({ dat: datOf([thing(100, { stackable: true }), thing(101)]) })
    expect(content.meta.lineage).toBeNull()
    expect(content.items.sid).toEqual([100, 101])
    expect(content.items.cid).toEqual([100, 101])
    expect(content.items.flags[0]! & ItemFlag.Stackable).toBeTruthy()
  })

  it('records the lineage, the client and the DAT signature', () => {
    const content = buildContent({ dat: datOf([thing(100)]), otb: otbOf([otbItem(2000, 100)]) })
    expect(content.meta).toEqual({
      schema: '2.0.0',
      client: 860,
      dat: '4C2C7993',
      lineage: { otbMajor: 3, otbMinor: 20 }
    })
  })

  it('takes gameplay from the OTB, falling back to the DAT', () => {
    const datFlags: ThingFlags = {
      unpassable: true,
      container: true,
      floorChange: true,
      writable: { length: 50 },
      minimap: { color: 7 }
    }
    const content = buildContent({
      dat: datOf([thing(100, datFlags)]),
      otb: otbOf([
        otbItem(
          2000,
          100,
          { unpassable: false, hangable: true, floorChangeNorth: true },
          { name: 'box', speed: 150, rotateTo: 2001 }
        )
      ])
    })
    const flags = content.items.flags[0]!
    expect(flags & ItemFlag.Walkable).toBeTruthy()
    expect(flags & ItemFlag.Container).toBeTruthy()
    expect(flags & ItemFlag.Hangable).toBeTruthy()
    expect(content.items.floorChange[0]).toBe(FloorChange.Any | FloorChange.North)
    expect(content.items.name[0]).toBe('box')
    expect(content.items.groundSpeed[0]).toBe(150)
    expect(content.items.rotateTo[0]).toBe(2001)
    expect(content.items.writableLength[0]).toBe(50)
    expect(content.items.writableOnceLength[0]).toBe(-1)
    expect(content.items.minimapColor[0]).toBe(7)
  })

  it('keeps the visual of each cid in its appearance', () => {
    const content = buildContent({
      dat: datOf([
        thing(100, { ground: { speed: 100 } }),
        thing(101, {
          groundBorder: true,
          hasElevation: { height: 8 },
          hasOffset: { offsetX: 8, offsetY: 8 }
        }),
        thing(102, {
          onBottom: true,
          lightInfo: { level: 4, color: 215 },
          translucent: true,
          lyingObject: true
        }),
        thing(103, { onTop: true }),
        thing(104)
      ])
    })
    const a = content.appearances
    expect(a.order).toEqual([
      StackOrder.Ground,
      StackOrder.Border,
      StackOrder.Bottom,
      StackOrder.Top,
      StackOrder.Common
    ])
    expect(a.elevation[1]).toBe(8)
    expect([a.offsetX[1], a.offsetY[1]]).toEqual([8, 8])
    expect([a.lightLevel[2], a.lightColor[2]]).toEqual([4, 215])
    expect(a.flags[2]).toBe(AppearanceFlag.Translucent | AppearanceFlag.LyingObject)
    expect(a.spriteStart).toEqual([0, 2, 4, 6, 8])
    expect(a.spriteIds.slice(2, 4)).toEqual([1010, 1011])
    expect(content.items.groundSpeed[0]).toBe(100)
  })

  it('keeps creatures, effects and missiles as separate appearances', () => {
    const content = buildContent({
      dat: datOf([
        thing(100),
        thing(1, {}, 'creatures'),
        thing(2, {}, 'effects'),
        thing(3, {}, 'missiles')
      ])
    })
    expect([content.creatures.cid, content.effects.cid, content.missiles.cid]).toEqual([
      [1],
      [2],
      [3]
    ])
    expect(content.items.sid).toEqual([100])
  })
})
