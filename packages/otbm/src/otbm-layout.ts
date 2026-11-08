import { ParseError } from '@paradoxlab/utils'
import type {
  ComposeOptions,
  OtbmHeader,
  OtbmMapData,
  OtbmSource,
  OtbmTileSource,
  OtbmTown,
  OtbmVisitor,
  OtbmWaypoint,
  SourceLayout,
  SourceLayoutArea,
  SourceLayoutEntry,
  SourceLayoutUnknown
} from './types.js'

type OpenArea = {
  x: number
  y: number
  z: number
  tail: Uint8Array | null
  tiles: number[]
  unknown: (SourceLayoutUnknown & { before: number })[]
}

type OpenList = {
  list: 'towns' | 'waypoints'
  towns: OtbmTown[]
  waypoints: OtbmWaypoint[]
  unknown: SourceLayoutUnknown[]
}

// Capture: the Source layout of a map, collected while it is read.

/**
 * A visitor that records the Source layout of a map: what the composer needs to write it back in
 * its original order, without the tile contents.
 */
export function collectSourceLayout(): { visitor: OtbmVisitor; layout(): SourceLayout } {
  let header: OtbmHeader | null = null
  let mapData: OtbmMapData | null = null
  const beforeMapData: SourceLayoutEntry[] = []
  const entries: SourceLayoutEntry[] = []
  const afterMapData: SourceLayoutEntry[] = []
  let group = beforeMapData
  let trailing: Uint8Array | null = null
  let ended = false
  let area: OpenArea | null = null
  let list: OpenList | null = null
  let depthInTile = 0

  const visitor: OtbmVisitor = {
    header(value) {
      header = value
    },
    mapData(value) {
      mapData = value
      group = entries
    },
    mapDataEnd() {
      group = afterMapData
    },
    area(x, y, z, tail) {
      area = { x, y, z, tail, tiles: [], unknown: [] }
    },
    areaEnd() {
      const { tiles, ...rest } = area!
      group.push({ kind: 'area', ...rest, tiles: Uint16Array.from(tiles) })
      area = null
    },
    tile(x, y) {
      area!.tiles.push(((x - area!.x) << 8) | (y - area!.y))
      depthInTile = 1
    },
    tileEnd() {
      depthInTile = 0
    },
    list(kind) {
      list = { list: kind, towns: [], waypoints: [], unknown: [] }
    },
    listEnd() {
      group.push({ kind: 'list', ...list! })
      list = null
    },
    town(town) {
      list!.towns.push(town)
    },
    waypoint(waypoint) {
      list!.waypoints.push(waypoint)
    },
    unknownNode(type, raw) {
      if (depthInTile > 0) return
      const node: SourceLayoutUnknown = { kind: 'unknown', type, raw }
      if (area !== null) area.unknown.push({ ...node, before: area.tiles.length })
      else if (list !== null) list.unknown.push(node)
      else group.push(node)
    },
    end(value) {
      trailing = value
      ended = true
    }
  }

  return {
    visitor,
    layout() {
      if (header === null || mapData === null || !ended) {
        throw new ParseError('The events did not describe a complete map')
      }
      return { header, mapData, beforeMapData, entries, afterMapData, trailing }
    }
  }
}

// Replay: a consumer's model written back in its Source layout.

const AREA_SIZE = 256
const BITS_PER_AREA = AREA_SIZE * AREA_SIZE

const areaKey = (x: number, y: number, z: number): number =>
  (z * AREA_SIZE + Math.floor(y / AREA_SIZE)) * AREA_SIZE + Math.floor(x / AREA_SIZE)

/** Which tiles were already written: one bit per tile, per 256x256 area, caching the last area. */
class WrittenTiles {
  readonly #areas = new Map<number, Uint8Array>()
  #lastKey = -1
  #last: Uint8Array = new Uint8Array(BITS_PER_AREA / 8)

  #bits(x: number, y: number, z: number): Uint8Array {
    const key = areaKey(x, y, z)
    if (key === this.#lastKey) return this.#last
    let bits = this.#areas.get(key)
    if (bits === undefined) {
      bits = new Uint8Array(BITS_PER_AREA / 8)
      this.#areas.set(key, bits)
    }
    this.#lastKey = key
    this.#last = bits
    return bits
  }

  has(x: number, y: number, z: number): boolean {
    const bit = ((y % AREA_SIZE) << 8) | (x % AREA_SIZE)
    return (this.#bits(x, y, z)[bit >> 3]! & (1 << (bit & 7))) !== 0
  }

  add(x: number, y: number, z: number): void {
    const bit = ((y % AREA_SIZE) << 8) | (x % AREA_SIZE)
    const bits = this.#bits(x, y, z)
    bits[bit >> 3]! |= 1 << (bit & 7)
  }
}

/** Every tile position listed by the layout, wherever its area is (malformed maps have areas outside the map data). */
function tilesInLayout(layout: SourceLayout): WrittenTiles {
  const positions = new WrittenTiles()
  for (const group of [layout.beforeMapData, layout.entries, layout.afterMapData]) {
    for (const entry of group) {
      if (entry.kind !== 'area') continue
      for (const offset of entry.tiles)
        positions.add(entry.x + (offset >> 8), entry.y + (offset & 0xff), entry.z)
    }
  }
  return positions
}

/**
 * Writes a consumer's map in its Source layout: unedited areas keep their order and tile order,
 * tiles deleted since are skipped (an area left empty is dropped), and tiles that are not in the
 * layout go after the last original area, in canonical 256x256 areas sorted by z, y, x.
 */
export function composeOtbm(
  layout: SourceLayout,
  tiles: OtbmTileSource,
  options: ComposeOptions = {}
): OtbmSource {
  const preserve = (options.layout ?? 'preserve') === 'preserve'

  return {
    *emit(visitor) {
      const written = new WrittenTiles()
      const inLayout = preserve ? tilesInLayout(layout) : new WrittenTiles()
      let lastAreaIndex = -1
      layout.entries.forEach((entry, index) => {
        if (entry.kind === 'area') lastAreaIndex = index
      })

      visitor.header?.(layout.header)
      yield* emitGroup(layout.beforeMapData, visitor, written)
      visitor.mapData?.(layout.mapData)
      if (preserve) {
        for (let i = 0; i < layout.entries.length; i++) {
          yield* emitGroup([layout.entries[i]!], visitor, written)
          if (i === lastAreaIndex) yield* emitNewTiles(visitor, written, inLayout)
        }
        if (lastAreaIndex < 0) yield* emitNewTiles(visitor, written, inLayout)
      } else {
        yield* emitNewTiles(visitor, written, inLayout)
        yield* emitGroup(
          layout.entries.filter((entry) => entry.kind !== 'area'),
          visitor,
          written
        )
      }
      visitor.mapDataEnd?.()
      yield* emitGroup(layout.afterMapData, visitor, written)
      visitor.end?.(layout.trailing)
    }
  }

  function* emitGroup(
    entries: readonly SourceLayoutEntry[],
    visitor: OtbmVisitor,
    written: WrittenTiles
  ): Generator<void, void, undefined> {
    for (const entry of entries) {
      if (entry.kind === 'unknown') {
        visitor.unknownNode?.(entry.type, entry.raw)
      } else if (entry.kind === 'list') {
        visitor.list?.(entry.list)
        if (entry.list === 'towns') {
          for (const town of options.towns ?? entry.towns) visitor.town?.(town)
        } else {
          for (const waypoint of options.waypoints ?? entry.waypoints) visitor.waypoint?.(waypoint)
        }
        for (const node of entry.unknown) visitor.unknownNode?.(node.type, node.raw)
        visitor.listEnd?.()
      } else if (preserve) {
        if (emitArea(entry, visitor, written)) yield
      }
    }
  }

  function emitArea(area: SourceLayoutArea, visitor: OtbmVisitor, written: WrittenTiles): boolean {
    const position = (offset: number) => [area.x + (offset >> 8), area.y + (offset & 0xff)] as const
    const isPending = (offset: number): boolean => {
      const [x, y] = position(offset)
      return !written.has(x, y, area.z) && tiles.hasTile(x, y, area.z)
    }
    const hadTiles = area.tiles.length > 0
    const keepsTiles = area.tiles.some(isPending)
    const isEmptiedByEdits = hadTiles && !keepsTiles && area.unknown.length === 0
    if (isEmptiedByEdits) return false

    visitor.area?.(area.x, area.y, area.z, area.tail)
    let next = 0
    const emitUnknownBefore = (index: number): void => {
      while (next < area.unknown.length && area.unknown[next]!.before <= index) {
        const node = area.unknown[next++]!
        visitor.unknownNode?.(node.type, node.raw)
      }
    }
    area.tiles.forEach((offset, index) => {
      emitUnknownBefore(index)
      const [x, y] = position(offset)
      if (written.has(x, y, area.z)) return
      if (tiles.emitTile(x, y, area.z, visitor)) written.add(x, y, area.z)
    })
    emitUnknownBefore(Number.POSITIVE_INFINITY)
    visitor.areaEnd?.()
    return true
  }

  function* emitNewTiles(
    visitor: OtbmVisitor,
    written: WrittenTiles,
    inLayout: WrittenTiles
  ): Generator<void, void, undefined> {
    const byArea = new Map<number, number[]>()
    tiles.forEachTile((x, y, z) => {
      const isNew = !written.has(x, y, z) && !inLayout.has(x, y, z)
      if (!isNew) return
      const key = areaKey(x, y, z)
      let positions = byArea.get(key)
      if (positions === undefined) {
        positions = []
        byArea.set(key, positions)
      }
      positions.push(y * 65_536 + x)
    })
    for (const key of [...byArea.keys()].sort((a, b) => a - b)) {
      const z = Math.floor(key / (AREA_SIZE * AREA_SIZE))
      const baseY = Math.floor(key / AREA_SIZE) % AREA_SIZE
      const baseX = key % AREA_SIZE
      visitor.area?.(baseX * AREA_SIZE, baseY * AREA_SIZE, z, null)
      for (const position of byArea.get(key)!.sort((a, b) => a - b)) {
        const x = position % 65_536
        const y = Math.floor(position / 65_536)
        if (tiles.emitTile(x, y, z, visitor)) written.add(x, y, z)
      }
      visitor.areaEnd?.()
      yield
    }
  }
}
