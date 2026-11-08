import type { DatFile, Thing, ThingFlags } from '@paradoxlab/dat'
import type { OtbFile, OtbItem } from '@paradoxlab/otb'
import type { Sprite, SprFile } from '@paradoxlab/spr'

const PIXELS = 32 * 32

/** Sprite n is a 4x4 block of value n at (n, n); sprite 1 is fully opaque; sprite 9 is empty. */
export function syntheticSpr(count = 9): SprFile {
  const sprites = new Map<number, Sprite>()
  for (let id = 1; id <= count; id++) {
    const rgba = new Uint8Array(PIXELS * 4)
    if (id === 1) for (let p = 0; p < PIXELS; p++) rgba.set([1, 0, 0, 255], p * 4)
    else if (id !== 9) {
      for (let y = id; y < id + 4; y++)
        for (let x = id; x < id + 4; x++) rgba.set([id, 0, 0, 255], (y * 32 + x) * 4)
    }
    sprites.set(id, { id, rgba, width: 32, height: 32 })
  }
  return {
    version: 860,
    signature: 0x12345678,
    count,
    get: (id) => sprites.get(id),
    entries: () => sprites.entries()
  }
}

function thing(
  cid: number,
  spriteIds: number[],
  flags: ThingFlags = {},
  layout: Partial<Thing['layout']> = {}
): Thing {
  return {
    cid,
    group: 'items',
    flags,
    layout: {
      width: 1,
      height: 1,
      layers: 1,
      patternX: 1,
      patternY: 1,
      patternZ: 1,
      frames: 1,
      realSize: 32,
      exactSize: 32,
      ...layout
    },
    spriteIds
  }
}

/**
 * cid 100 ground, 101 border, 102 two layers, 103 2x2, 104 stackable (4x2 patterns), 105 empty,
 * 106 not used by any item.
 */
export function syntheticDat(): DatFile {
  const things = [
    thing(100, [1], { ground: { speed: 150 } }),
    thing(101, [2], { groundBorder: true }),
    thing(102, [1, 3], {}, { layers: 2 }),
    thing(103, [4, 5, 9, 6], { hasOffset: { offsetX: 8, offsetY: 8 } }, { width: 2, height: 2 }),
    thing(104, [2, 3, 4, 5, 6, 7, 8, 2], { stackable: true }, { patternX: 4, patternY: 2 }),
    thing(105, [9]),
    thing(106, [7])
  ]
  return {
    version: 860,
    signature: 0x4c2c7993,
    counts: { itemsMaxCid: 106, creatures: 0, effects: 0, missiles: 0 },
    things,
    get: (_group, cid) => things.find((t) => t.cid === cid),
    entries: () => things
  }
}

const otbItem = (sid: number, cid: number, name = ''): OtbItem =>
  ({ sid, cid, group: 0, flags: {}, attributes: name === '' ? {} : { name } }) as OtbItem

/** sids 2000-2005 on cids 100-105; 2006 shares cid 104; 2007 points at a cid the client lacks. */
export function syntheticOtb(): OtbFile {
  const items = [
    otbItem(2000, 100, 'grass'),
    otbItem(2001, 101),
    otbItem(2002, 102),
    otbItem(2003, 103),
    otbItem(2004, 104, 'gold coin'),
    otbItem(2005, 105),
    otbItem(2006, 104),
    otbItem(2007, 999)
  ]
  return {
    schemaVersion: '3.20.62',
    count: items.length,
    items,
    get: (sid) => items.find((item) => item.sid === sid),
    entries: () => items.map((item) => [item.sid, item] as [number, OtbItem])
  }
}
