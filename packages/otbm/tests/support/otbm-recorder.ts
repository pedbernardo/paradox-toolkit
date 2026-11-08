import type {
  OtbmDocument,
  OtbmDocumentNode,
  OtbmDocumentTile,
  OtbmSource,
  OtbmTileSource,
  OtbmVisitor
} from '../../src/types.js'

export type RecordedEvent = [string, ...unknown[]]

const plain = (value: unknown): unknown => {
  if (value instanceof Uint8Array) return [...value]
  if (Array.isArray(value)) return value.map(plain)
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, plain(v)]))
  }
  return value
}

const EVENTS = [
  'header',
  'mapData',
  'mapDataEnd',
  'area',
  'areaEnd',
  'tile',
  'tileEnd',
  'item',
  'itemEnd',
  'list',
  'listEnd',
  'town',
  'waypoint',
  'unknownNode',
  'diagnostic',
  'end'
] as const

/** Records every event as plain data, for comparisons; diagnostics are recorded apart. */
export function recorder(): {
  visitor: Required<OtbmVisitor>
  events: RecordedEvent[]
  diagnostics: unknown[]
} {
  const events: RecordedEvent[] = []
  const diagnostics: unknown[] = []
  const visitor = Object.fromEntries(
    EVENTS.map((name) => [
      name,
      (...args: unknown[]) => {
        if (name === 'diagnostic') diagnostics.push(plain(args[0]))
        else events.push([name, ...args.map(plain)])
      }
    ])
  ) as unknown as Required<OtbmVisitor>
  return { visitor, events, diagnostics }
}

/** A tile source over a document's tiles, keyed by position, standing in for a consumer's model. */
export function documentTileSource(document: OtbmDocument): OtbmTileSource & {
  tiles: Map<string, OtbmDocumentTile>
} {
  const tiles = new Map<string, OtbmDocumentTile>()
  for (const group of [document.beforeMapData, document.entries, document.afterMapData]) {
    for (const entry of group) {
      if (entry.kind !== 'area') continue
      for (const tile of entry.tiles)
        if (tile.kind === 'tile') tiles.set(`${tile.x},${tile.y},${tile.z}`, tile)
    }
  }
  const emitNodes = (nodes: readonly OtbmDocumentNode[], visitor: OtbmVisitor): void => {
    for (const entry of nodes) {
      if (entry.kind === 'unknown') {
        visitor.unknownNode?.(entry.type, entry.raw)
        continue
      }
      visitor.item?.(entry.sid, entry.form, entry.attributes)
      if (entry.children !== null) emitNodes(entry.children, visitor)
      visitor.itemEnd?.()
    }
  }
  return {
    tiles,
    hasTile: (x, y, z) => tiles.has(`${x},${y},${z}`),
    emitTile(x, y, z, visitor) {
      const tile = tiles.get(`${x},${y},${z}`)
      if (tile === undefined) return false
      visitor.tile?.(tile.x, tile.y, tile.z, tile.flags, tile.houseId, tile.tail)
      emitNodes(tile.items, visitor)
      visitor.tileEnd?.()
      return true
    },
    forEachTile(fn) {
      for (const tile of tiles.values()) fn(tile.x, tile.y, tile.z)
    }
  }
}

/** Runs an event source to its end. */
export function drain(source: OtbmSource, visitor: OtbmVisitor): void {
  const steps = source.emit(visitor)[Symbol.iterator]()
  while (steps.next().done !== true) continue
}
