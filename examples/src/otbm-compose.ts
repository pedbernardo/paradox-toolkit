import { Otbm, collectSourceLayout, composeOtbm } from '@paradoxlab/otbm'
import type {
  ItemForm,
  OtbmItemAttribute,
  OtbmOptions,
  OtbmTileSource,
  OtbmVisitor
} from '@paradoxlab/otbm'

/** A consumer's own model: tiles by position with their item stacks. Real editors use columns. */
type Item = {
  sid: number
  form: ItemForm
  attributes: readonly OtbmItemAttribute[] | null
  children: Item[]
}
type Tile = {
  x: number
  y: number
  z: number
  flags: number | null
  houseId: number | null
  items: Item[]
}
type Model = Map<string, Tile>

const key = (x: number, y: number, z: number) => `${x},${y},${z}`

function emitItems(items: readonly Item[], visitor: OtbmVisitor): void {
  for (const item of items) {
    visitor.item?.(item.sid, item.form, item.attributes)
    emitItems(item.children, visitor)
    visitor.itemEnd?.()
  }
}

/**
 * Loads a map into an own model and its Source layout in one pass, edits the model, and writes it
 * back with the composer: unedited areas keep their bytes, new tiles go to canonical areas.
 */
export function addTileWithComposer(bytes: Uint8Array, options: OtbmOptions = {}): Uint8Array {
  const otbm = Otbm(options)
  const model: Model = new Map()
  const stack: Item[][] = []
  const layout = collectSourceLayout()
  otbm.read(bytes, [
    layout.visitor,
    {
      tile: (x, y, z, flags, houseId) => {
        const tile: Tile = { x, y, z, flags, houseId, items: [] }
        model.set(key(x, y, z), tile)
        stack.length = 0
        stack.push(tile.items)
      },
      item: (sid, form, attributes) => {
        const item: Item = { sid, form, attributes, children: [] }
        stack.at(-1)!.push(item)
        stack.push(item.children)
      },
      itemEnd: () => {
        stack.pop()
      }
    }
  ])

  model.set(key(300, 300, 7), {
    x: 300,
    y: 300,
    z: 7,
    flags: null,
    houseId: null,
    items: [{ sid: 4526, form: 'node', attributes: null, children: [] }]
  })

  const tiles: OtbmTileSource = {
    hasTile: (x, y, z) => model.has(key(x, y, z)),
    emitTile(x, y, z, visitor) {
      const tile = model.get(key(x, y, z))
      if (tile === undefined) return false
      visitor.tile?.(x, y, z, tile.flags, tile.houseId, null)
      emitItems(tile.items, visitor)
      visitor.tileEnd?.()
      return true
    },
    forEachTile(fn) {
      for (const tile of model.values()) fn(tile.x, tile.y, tile.z)
    }
  }
  return otbm.write(composeOtbm(layout.layout(), tiles))
}
