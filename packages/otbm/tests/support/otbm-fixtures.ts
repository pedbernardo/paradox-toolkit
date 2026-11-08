import { fixtures, readFixture } from '@paradoxlab/fixtures'
import type { ResolvedMap } from '@paradoxlab/fixtures'
import { Otb, inlineCountOf } from '@paradoxlab/otb'
import type { OtbmOptions } from '../../src/types.js'

/** The map bytes and the options to read it (v1 maps get the predicate from their items.otb). */
export function loadMap(map: ResolvedMap): { bytes: Uint8Array; options: OtbmOptions } {
  const bytes = readFixture(map.map)
  if (map.otbm !== 1) return { bytes, options: {} }
  if (map.itemsFile === undefined) throw new Error(`${map.id}: OTBM v1 needs its items.otb fixture`)
  const otb = Otb().load(readFixture(map.itemsFile))
  return { bytes, options: { hasInlineCount: inlineCountOf(otb) } }
}

export const presentMaps = (): ResolvedMap[] => fixtures().presentMaps()
export const publicMaps = (): ResolvedMap[] => fixtures().presentMaps((map) => map.public)

export function firstDifference(a: Uint8Array, b: Uint8Array): number {
  const length = Math.max(a.length, b.length)
  for (let i = 0; i < length; i++) if (a[i] !== b[i]) return i
  return -1
}
