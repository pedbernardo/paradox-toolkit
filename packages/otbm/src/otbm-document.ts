import { ParseError } from '@paradoxlab/utils'
import type {
  OtbmDiagnostic,
  OtbmDocument,
  OtbmDocumentArea,
  OtbmDocumentEntry,
  OtbmDocumentItem,
  OtbmDocumentList,
  OtbmDocumentNode,
  OtbmDocumentStats,
  OtbmDocumentTile,
  OtbmDocumentUnknown,
  OtbmHeader,
  OtbmMapData,
  OtbmVisitor
} from './types.js'

const tileKey = (x: number, y: number, z: number): number => x + y * 65_536 + z * 4_294_967_296

type Collector = {
  visitor: OtbmVisitor
  document(): OtbmDocument
}

/** A visitor that builds an `OtbmDocument` from the events of one map. */
export function collectDocument(): Collector {
  let header: OtbmHeader | null = null
  let mapData: OtbmMapData | null = null
  const beforeMapData: OtbmDocumentEntry[] = []
  const entries: OtbmDocumentEntry[] = []
  const afterMapData: OtbmDocumentEntry[] = []
  const diagnostics: OtbmDiagnostic[] = []
  let trailing: Uint8Array | null = null
  let ended = false

  let rootEntries = beforeMapData
  let area: OtbmDocumentArea | null = null
  let list: OtbmDocumentList | null = null
  let tile: OtbmDocumentTile | null = null
  const items: OtbmDocumentItem[] = []

  const unknown = (type: number, raw: Uint8Array): OtbmDocumentUnknown => ({
    kind: 'unknown',
    type,
    raw
  })

  const visitor: OtbmVisitor = {
    header(value) {
      header = value
    },
    mapData(value) {
      mapData = value
      rootEntries = entries
    },
    mapDataEnd() {
      rootEntries = afterMapData
    },
    area(x, y, z, tail) {
      area = { kind: 'area', x, y, z, tail, tiles: [] }
      rootEntries.push(area)
    },
    areaEnd() {
      area = null
    },
    tile(x, y, z, flags, houseId, tail) {
      tile = { kind: 'tile', x, y, z, flags, houseId, tail, items: [] }
      area!.tiles.push(tile)
    },
    tileEnd() {
      tile = null
    },
    item(sid, form, attributes) {
      const item: OtbmDocumentItem = {
        kind: 'item',
        sid,
        form,
        attributes: attributes === null ? null : [...attributes],
        children: null
      }
      const parent = items.at(-1)
      if (parent !== undefined) (parent.children ??= []).push(item)
      else tile!.items.push(item)
      items.push(item)
    },
    itemEnd() {
      items.pop()
    },
    list(kind) {
      list = { kind: 'list', list: kind, children: [] }
      rootEntries.push(list)
    },
    listEnd() {
      list = null
    },
    town(town) {
      list!.children.push({ kind: 'town', ...town })
    },
    waypoint(waypoint) {
      list!.children.push({ kind: 'waypoint', ...waypoint })
    },
    unknownNode(type, raw) {
      const node = unknown(type, raw)
      const parent = items.at(-1)
      if (parent !== undefined) (parent.children ??= []).push(node)
      else if (tile !== null) tile.items.push(node)
      else if (area !== null) area.tiles.push(node)
      else if (list !== null) list.children.push(node)
      else rootEntries.push(node)
    },
    diagnostic(diagnostic) {
      diagnostics.push(diagnostic)
    },
    end(value) {
      trailing = value
      ended = true
    }
  }

  return {
    visitor,
    document() {
      if (header === null || mapData === null || !ended) {
        throw new ParseError('The events did not describe a complete map')
      }
      return createDocument({
        header,
        mapData,
        beforeMapData,
        entries,
        afterMapData,
        trailing,
        diagnostics
      })
    }
  }
}

type DocumentData = Pick<
  OtbmDocument,
  'header' | 'mapData' | 'beforeMapData' | 'entries' | 'afterMapData' | 'trailing' | 'diagnostics'
>

function* areasOf(document: DocumentData): Generator<OtbmDocumentArea> {
  for (const group of [document.beforeMapData, document.entries, document.afterMapData]) {
    for (const entry of group) if (entry.kind === 'area') yield entry
  }
}

function createDocument(data: DocumentData): OtbmDocument {
  const index = new Map<number, OtbmDocumentTile>()
  for (const area of areasOf(data)) {
    for (const tile of area.tiles)
      if (tile.kind === 'tile') index.set(tileKey(tile.x, tile.y, tile.z), tile)
  }

  const document: OtbmDocument = {
    ...data,
    getTile: (x, y, z) => index.get(tileKey(x, y, z)),
    stats() {
      const stats: OtbmDocumentStats = { areas: 0, tiles: 0, items: 0 }
      const countItems = (nodes: readonly OtbmDocumentNode[]): void => {
        for (const node of nodes) {
          if (node.kind !== 'item') continue
          stats.items++
          if (node.children !== null) countItems(node.children)
        }
      }
      for (const area of areasOf(document)) {
        stats.areas++
        for (const tile of area.tiles) {
          if (tile.kind !== 'tile') continue
          stats.tiles++
          countItems(tile.items)
        }
      }
      return stats
    },
    *emit(visitor) {
      visitor.header?.(document.header)
      yield* emitEntries(document.beforeMapData, visitor)
      visitor.mapData?.(document.mapData)
      yield* emitEntries(document.entries, visitor)
      visitor.mapDataEnd?.()
      yield* emitEntries(document.afterMapData, visitor)
      visitor.end?.(document.trailing)
    }
  }
  return document
}

function emitNodes(nodes: readonly OtbmDocumentNode[], visitor: OtbmVisitor): void {
  for (const node of nodes) {
    if (node.kind === 'unknown') {
      visitor.unknownNode?.(node.type, node.raw)
      continue
    }
    visitor.item?.(node.sid, node.form, node.attributes)
    if (node.children !== null) emitNodes(node.children, visitor)
    visitor.itemEnd?.()
  }
}

function* emitEntries(
  entries: readonly OtbmDocumentEntry[],
  visitor: OtbmVisitor
): Generator<void, void, undefined> {
  for (const entry of entries) {
    if (entry.kind === 'unknown') {
      visitor.unknownNode?.(entry.type, entry.raw)
    } else if (entry.kind === 'list') {
      visitor.list?.(entry.list)
      for (const child of entry.children) {
        if (child.kind === 'unknown') {
          visitor.unknownNode?.(child.type, child.raw)
        } else if (child.kind === 'town') {
          const { kind: _kind, ...town } = child
          visitor.town?.(town)
        } else {
          const { kind: _kind, ...waypoint } = child
          visitor.waypoint?.(waypoint)
        }
      }
      visitor.listEnd?.()
    } else {
      visitor.area?.(entry.x, entry.y, entry.z, entry.tail)
      for (const tile of entry.tiles) {
        if (tile.kind === 'unknown') {
          visitor.unknownNode?.(tile.type, tile.raw)
          continue
        }
        visitor.tile?.(tile.x, tile.y, tile.z, tile.flags, tile.houseId, tile.tail)
        emitNodes(tile.items, visitor)
        visitor.tileEnd?.()
      }
      visitor.areaEnd?.()
      yield
    }
  }
}
