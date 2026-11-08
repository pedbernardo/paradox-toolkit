import { describe, expect, it } from 'vitest'
import type { DatFile, Thing, ThingFlags } from '@paradoxlab/dat'
import type { OtbFile, OtbItem } from '@paradoxlab/otb'
import {
  AppearanceFlag,
  FloorChange,
  ItemFlag,
  StackOrder,
  buildContent
} from './backpack-content.js'
import { viewContent, viewFrames } from './backpack-views.js'

const layout = {
  width: 2,
  height: 1,
  layers: 1,
  patternX: 1,
  patternY: 1,
  patternZ: 1,
  frames: 1,
  realSize: 64,
  exactSize: 64
}

const thing = (cid: number, flags: ThingFlags = {}): Thing => ({
  cid,
  group: 'items',
  flags,
  layout,
  spriteIds: [cid * 10, cid * 10 + 1]
})

const dat = (things: Thing[]): DatFile => ({
  version: 860,
  signature: 0x4c2c7993,
  counts: { itemsMaxCid: 0, creatures: 0, effects: 0, missiles: 0 },
  things,
  get: () => undefined,
  entries: () => things
})

const otb = (items: Partial<OtbItem>[]): OtbFile => {
  const full = items.map((item) => ({ group: 0, flags: {}, attributes: {}, ...item }) as OtbItem)
  return {
    schemaVersion: '3.20.62',
    count: full.length,
    items: full,
    get: () => undefined,
    entries: () => full.map((item) => [item.sid, item] as [number, OtbItem])
  }
}

const content = buildContent({
  dat: dat([
    thing(100, {
      stackable: true,
      onBottom: true,
      lightInfo: { level: 3, color: 210 },
      translucent: true,
      hasElevation: { height: 8 },
      floorChange: true
    }),
    thing(101)
  ]),
  otb: otb([
    { sid: 2000, cid: 100, attributes: { name: 'coin', rotateTo: 2001 } },
    { sid: 2001, cid: 101 },
    { sid: 2002, cid: 999 }
  ])
})

describe('viewContent', () => {
  const view = viewContent(content)

  it('finds items by sid and misses unknown sids', () => {
    expect(view.items.size).toBe(3)
    expect(view.items.get(2001)?.cid).toBe(101)
    expect(view.items.get(1999)).toBeUndefined()
    expect(view.items.get(5000)).toBeUndefined()
    expect(view.items.get(-1)).toBeUndefined()
  })

  it('reads gameplay from the columns, -1 as null', () => {
    const coin = view.items.get(2000)!
    expect(coin.name).toBe('coin')
    expect(coin.has(ItemFlag.Stackable)).toBe(true)
    expect(coin.has(ItemFlag.Container)).toBe(false)
    expect(coin.changesFloor(FloorChange.Any)).toBe(true)
    expect(coin.rotateTo).toBe(2001)
    expect(coin.writableLength).toBeNull()
  })

  it('reaches the appearance of the item cid', () => {
    const look = view.items.get(2000)!.appearance!
    expect(look.cid).toBe(100)
    expect(look.layout).toEqual({
      width: 2,
      height: 1,
      layers: 1,
      patternX: 1,
      patternY: 1,
      patternZ: 1,
      frames: 1
    })
    expect(look.spriteIds).toEqual([1000, 1001])
    expect(look.sprite(1)).toBe(1001)
    expect(look.sprite(2)).toBeUndefined()
    expect(look.sprite(-1)).toBeUndefined()
    expect(look.order).toBe(StackOrder.Bottom)
    expect(look.elevation).toBe(8)
    expect(look.offset).toEqual({ x: 0, y: 0 })
    expect(look.light).toEqual({ level: 3, color: 210 })
    expect(look.has(AppearanceFlag.Translucent)).toBe(true)
    expect(view.items.get(2001)!.appearance!.spriteIds).toEqual([1010, 1011])
    expect(view.items.get(2001)!.appearance!.light).toBeNull()
  })

  it('mirrors every item column', () => {
    const coin = view.items.get(2000)!
    const columns = content.items
    expect({
      sid: coin.sid,
      description: coin.description,
      groundSpeed: coin.groundSpeed,
      weight: coin.weight,
      maxItems: coin.maxItems,
      maxWriteLength: coin.maxWriteLength,
      writableOnceLength: coin.writableOnceLength,
      alwaysOnTopOrder: coin.alwaysOnTopOrder,
      minimapColor: coin.minimapColor,
      lensHelp: coin.lensHelp
    }).toEqual({
      sid: 2000,
      description: columns.description[0],
      groundSpeed: columns.groundSpeed[0],
      weight: columns.weight[0],
      maxItems: columns.maxItems[0],
      maxWriteLength: columns.maxWriteLength[0],
      writableOnceLength: null,
      alwaysOnTopOrder: columns.alwaysOnTopOrder[0],
      minimapColor: null,
      lensHelp: null
    })
  })

  it('gives no appearance when the client lacks the cid', () => {
    expect(view.items.get(2002)!.appearance).toBeNull()
  })

  it('iterates items in row order', () => {
    expect([...view.items].map((item) => item.sid)).toEqual([2000, 2001, 2002])
  })
})

describe('viewFrames', () => {
  it('finds a frame by sprite id', () => {
    const frames = viewFrames({
      id: [5, 9],
      page: [0, -1],
      x: [1, 0],
      y: [2, 0],
      w: [32, 0],
      h: [30, 0],
      offsetX: [0, 0],
      offsetY: [2, 0]
    })
    expect(frames.size).toBe(2)
    expect(frames.get(5)).toEqual({
      id: 5,
      page: 0,
      x: 1,
      y: 2,
      w: 32,
      h: 30,
      offsetX: 0,
      offsetY: 2
    })
    expect(frames.get(9)?.page).toBe(-1)
    expect(frames.get(6)).toBeUndefined()
  })
})
