import { Otbm } from '@paradoxlab/otbm'
import type { OtbmOptions } from '@paradoxlab/otbm'

/**
 * Loads a map as objects, sets an action id on every item of one sid, and writes it back. Every
 * other byte of the file stays the same. Meant for small and medium maps: `load` keeps an object
 * per tile and item.
 */
export function setActionId(
  bytes: Uint8Array,
  sid: number,
  actionId: number,
  options: OtbmOptions = {}
): { bytes: Uint8Array; changed: number } {
  const otbm = Otbm(options)
  const document = otbm.load(bytes)
  let changed = 0
  for (const entry of document.entries) {
    if (entry.kind !== 'area') continue
    for (const tile of entry.tiles) {
      if (tile.kind !== 'tile') continue
      for (const item of tile.items) {
        if (item.kind !== 'item' || item.sid !== sid) continue
        const others = (item.attributes ?? []).filter((attribute) => attribute.kind !== 'actionId')
        item.attributes = [{ kind: 'actionId', value: actionId }, ...others]
        if (item.form === 'inline') item.form = 'node'
        changed++
      }
    }
  }
  return { bytes: otbm.write(document), changed }
}
