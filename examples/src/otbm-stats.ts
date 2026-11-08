import { Otbm } from '@paradoxlab/otbm'
import type { OtbmOptions } from '@paradoxlab/otbm'

export type MapStats = {
  version: string
  tiles: number
  houseTiles: number
  items: number
  towns: string[]
}

/** Counts a map with a visitor: one pass, no object per tile or item. */
export function otbmStats(bytes: Uint8Array, options: OtbmOptions = {}): MapStats {
  const stats: MapStats = { version: '', tiles: 0, houseTiles: 0, items: 0, towns: [] }
  Otbm(options).read(bytes, {
    header: (header) => {
      stats.version = `OTBM v${header.version + 1}, OTB ${header.otbMajor}.${header.otbMinor}`
    },
    tile: (_x, _y, _z, _flags, houseId) => {
      stats.tiles++
      if (houseId !== null) stats.houseTiles++
    },
    item: () => {
      stats.items++
    },
    town: (town) => {
      stats.towns.push(town.name)
    }
  })
  return stats
}
