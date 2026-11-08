import type { DatFile, Thing } from '@paradoxlab/dat'
import type { OtbFile, OtbItem } from '@paradoxlab/otb'
import type { Sprite, SprFile } from '@paradoxlab/spr'

const PIXELS = 32 * 32

/** Sprites 1-8: sprite n is an n x n opaque square in the bottom-right corner. */
function sampleSpr(): SprFile {
  const sprites = new Map<number, Sprite>()
  for (let id = 1; id <= 8; id++) {
    const rgba = new Uint8Array(PIXELS * 4)
    const side = id * 4
    for (let y = 32 - side; y < 32; y++)
      for (let x = 32 - side; x < 32; x++) rgba.set([id * 30, 200, 0, 255], (y * 32 + x) * 4)
    sprites.set(id, { id, rgba, width: 32, height: 32 })
  }
  return {
    version: 860,
    signature: 0x1,
    count: 8,
    get: (id) => sprites.get(id),
    entries: () => sprites.entries()
  }
}

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

/**
 * A tiny client: grass (cid 100) and a stackable gold coin (cid 101) whose 4x2 patterns show 1, 2,
 * 3, 4, 5, 10, 25 and 50 coins, as the real client does.
 */
export function sampleClient(): { dat: DatFile; spr: SprFile; otb: OtbFile } {
  const things: Thing[] = [
    { cid: 100, group: 'items', flags: { ground: { speed: 150 } }, layout, spriteIds: [8] },
    {
      cid: 101,
      group: 'items',
      flags: { stackable: true },
      layout: { ...layout, patternX: 4, patternY: 2 },
      spriteIds: [1, 2, 3, 4, 5, 6, 7, 8]
    }
  ]
  const dat: DatFile = {
    version: 860,
    signature: 0x2,
    counts: { itemsMaxCid: 101, creatures: 0, effects: 0, missiles: 0 },
    things,
    get: (_group, cid) => things.find((t) => t.cid === cid),
    entries: () => things
  }
  const items = [
    { sid: 102, cid: 100, group: 0, flags: {}, attributes: { name: 'grass' } },
    { sid: 2148, cid: 101, group: 0, flags: { stackable: true }, attributes: { name: 'gold coin' } }
  ] as OtbItem[]
  const otb: OtbFile = {
    schemaVersion: '3.20.62',
    count: items.length,
    items,
    get: (sid) => items.find((item) => item.sid === sid),
    entries: () => items.map((item) => [item.sid, item] as [number, OtbItem])
  }
  return { dat, spr: sampleSpr(), otb }
}
