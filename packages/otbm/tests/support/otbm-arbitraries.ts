import fc from 'fast-check'
import { windows1252 } from '@paradoxlab/utils'
import type {
  OtbmHeader,
  OtbmItemAttribute,
  OtbmMapDataAttribute,
  OtbmSource,
  OtbmTown,
  OtbmVisitor,
  OtbmWaypoint
} from '../../src/types.js'

const KNOWN_ITEM_ATTRIBUTES = new Set([4, 5, 6, 7, 8, 10, 12, 14, 15, 16, 17, 18, 19, 20, 21, 22])
const KNOWN_TILE_ATTRIBUTES = new Set([3, 9])
const KNOWN_MAP_ATTRIBUTES = new Set([1, 11, 13])

const u8 = fc.integer({ min: 0, max: 0xff })
const u16 = fc.integer({ min: 0, max: 0xffff })
const u32 = fc.integer({ min: 0, max: 0xffff_ffff })
const text = fc.uint8Array({ maxLength: 12 }).map((bytes) => windows1252.decode(bytes))

/** Bytes that start with an attribute id the reader does not know, so they read back as a tail. */
const tail = (known: Set<number>) =>
  fc
    .tuple(
      u8.filter((id) => !known.has(id)),
      fc.uint8Array({ maxLength: 6 })
    )
    .map(([id, rest]) => Uint8Array.from([id, ...rest]))

/** A complete unknown node: start, a type the reader does not model, escaped props, end. */
const unknownNode = fc
  .tuple(fc.integer({ min: 0x30, max: 0x3f }), fc.uint8Array({ maxLength: 6 }))
  .map(([type, props]) => ({
    kind: 'unknown' as const,
    type,
    raw: Uint8Array.from([
      0xfe,
      type,
      ...[...props].flatMap((b) => (b >= 0xfd ? [0xfd, b] : [b])),
      0xff
    ])
  }))

const itemAttribute: fc.Arbitrary<OtbmItemAttribute> = fc.oneof(
  u8.map((value) => ({ kind: 'count' as const, value })),
  u16.map((value) => ({ kind: 'actionId' as const, value })),
  u16.map((value) => ({ kind: 'uniqueId' as const, value })),
  text.map((value) => ({ kind: 'text' as const, value })),
  text.map((value) => ({ kind: 'description' as const, value })),
  fc.tuple(u16, u16, u8).map(([x, y, z]) => ({ kind: 'teleport' as const, x, y, z })),
  u16.map((value) => ({ kind: 'depotId' as const, value })),
  u8.map((value) => ({ kind: 'runeCharges' as const, value })),
  u8.map((value) => ({ kind: 'houseDoorId' as const, value })),
  u32.map((value) => ({ kind: 'duration' as const, value })),
  u8.map((value) => ({ kind: 'decayState' as const, value })),
  u32.map((value) => ({ kind: 'writtenDate' as const, value })),
  text.map((value) => ({ kind: 'writtenBy' as const, value })),
  u32.map((value) => ({ kind: 'sleeperGuid' as const, value })),
  u32.map((value) => ({ kind: 'sleepStart' as const, value })),
  u16.map((value) => ({ kind: 'charges' as const, value }))
)

const attributes = fc
  .tuple(
    fc.array(itemAttribute, { maxLength: 4 }),
    fc.option(tail(KNOWN_ITEM_ATTRIBUTES), { nil: null })
  )
  .map(([known, unknown]) => {
    const list: OtbmItemAttribute[] = [...known]
    if (unknown !== null) list.push({ kind: 'unknown', bytes: unknown })
    return list.length === 0 ? null : list
  })

export type SpecItem = {
  kind: 'item'
  sid: number
  attributes: OtbmItemAttribute[] | null
  children: SpecNode[]
}
export type SpecNode = SpecItem | { kind: 'unknown'; type: number; raw: Uint8Array }

const { node } = fc.letrec<{ node: SpecNode; item: SpecItem }>((tie) => ({
  item: fc.record({
    kind: fc.constant('item' as const),
    sid: u16,
    attributes,
    children: fc.array(tie('node'), { maxLength: 2, depthIdentifier: 'items' })
  }),
  node: fc.oneof(
    { maxDepth: 3, depthIdentifier: 'items', withCrossShrink: true },
    unknownNode,
    tie('item')
  )
}))

export type SpecTile = {
  dx: number
  dy: number
  flags: number | null
  houseId: number | null
  tail: Uint8Array | null
  inline: number[]
  nodes: SpecNode[]
}

const tile = fc.record({
  dx: u8,
  dy: u8,
  flags: fc.option(u32, { nil: null }),
  houseId: fc.option(u32, { nil: null }),
  tail: fc.option(tail(KNOWN_TILE_ATTRIBUTES), { nil: null }),
  inline: fc.array(u16, { maxLength: 3 }),
  nodes: fc.array(node, { maxLength: 3 })
})

export type SpecArea = {
  x: number
  y: number
  z: number
  tail: Uint8Array | null
  tiles: SpecTile[]
}

const area = fc.record({
  x: fc.integer({ min: 0, max: 0xffff - 0xff }),
  y: fc.integer({ min: 0, max: 0xffff - 0xff }),
  z: fc.integer({ min: 0, max: 15 }),
  tail: fc.option(fc.uint8Array({ minLength: 1, maxLength: 4 }), { nil: null }),
  tiles: fc.uniqueArray(tile, { maxLength: 5, selector: (t) => `${t.dx},${t.dy}` })
})

const town = fc.record({
  id: u32,
  name: text,
  x: u16,
  y: u16,
  z: u8,
  tail: fc.option(fc.uint8Array({ minLength: 1, maxLength: 3 }), { nil: null })
})
const waypoint = fc.record({
  name: text,
  x: u16,
  y: u16,
  z: u8,
  tail: fc.option(fc.uint8Array({ minLength: 1, maxLength: 3 }), { nil: null })
})

const mapAttribute: fc.Arbitrary<OtbmMapDataAttribute> = fc.oneof(
  text.map((value) => ({ kind: 'description' as const, value })),
  text.map((value) => ({ kind: 'spawnFile' as const, value })),
  text.map((value) => ({ kind: 'houseFile' as const, value }))
)

export type MapSpec = {
  header: OtbmHeader
  mapData: OtbmMapDataAttribute[]
  areas: SpecArea[]
  towns: OtbmTown[] | null
  waypoints: OtbmWaypoint[] | null
  unknown: { kind: 'unknown'; type: number; raw: Uint8Array }[]
  trailing: Uint8Array | null
}

/** A valid map with every feature of the Shape, in OTBM v2 or v3 (header version 1 or 2). */
export const mapSpec: fc.Arbitrary<MapSpec> = fc.record({
  header: fc.record({
    identifier: u32,
    version: fc.integer({ min: 1, max: 2 }),
    width: u16,
    height: u16,
    otbMajor: u32,
    otbMinor: u32,
    rootType: fc.integer({ min: 0, max: 2 }),
    tail: fc.option(fc.uint8Array({ minLength: 1, maxLength: 4 }), { nil: null })
  }),
  mapData: fc
    .tuple(
      fc.array(mapAttribute, { maxLength: 3 }),
      fc.option(tail(KNOWN_MAP_ATTRIBUTES), { nil: null })
    )
    .map(([known, unknown]) =>
      unknown === null ? known : [...known, { kind: 'unknown' as const, bytes: unknown }]
    ),
  areas: fc.array(area, { maxLength: 3 }),
  towns: fc.option(fc.array(town, { maxLength: 2 }), { nil: null }),
  waypoints: fc.option(fc.array(waypoint, { maxLength: 2 }), { nil: null }),
  unknown: fc.array(unknownNode, { maxLength: 2 }),
  trailing: fc.option(fc.uint8Array({ minLength: 1, maxLength: 3 }), { nil: null })
})

function emitNodes(nodes: readonly SpecNode[], visitor: OtbmVisitor): void {
  for (const n of nodes) {
    if (n.kind === 'unknown') {
      visitor.unknownNode?.(n.type, n.raw)
      continue
    }
    visitor.item?.(n.sid, 'node', n.attributes)
    emitNodes(n.children, visitor)
    visitor.itemEnd?.()
  }
}

/** The events a map spec describes, as an event source. */
export function specSource(spec: MapSpec): OtbmSource {
  return {
    *emit(visitor) {
      visitor.header?.(spec.header)
      visitor.mapData?.({ attributes: spec.mapData })
      for (const a of spec.areas) {
        visitor.area?.(a.x, a.y, a.z, a.tail)
        for (const t of a.tiles) {
          visitor.tile?.(a.x + t.dx, a.y + t.dy, a.z, t.flags, t.houseId, t.tail)
          for (const sid of t.inline) {
            visitor.item?.(sid, 'inline', null)
            visitor.itemEnd?.()
          }
          emitNodes(t.nodes, visitor)
          visitor.tileEnd?.()
        }
        visitor.areaEnd?.()
        yield
      }
      if (spec.towns !== null) {
        visitor.list?.('towns')
        for (const t of spec.towns) visitor.town?.(t)
        visitor.listEnd?.()
      }
      if (spec.waypoints !== null) {
        visitor.list?.('waypoints')
        for (const w of spec.waypoints) visitor.waypoint?.(w)
        visitor.listEnd?.()
      }
      for (const u of spec.unknown) visitor.unknownNode?.(u.type, u.raw)
      visitor.mapDataEnd?.()
      visitor.end?.(spec.trailing)
    }
  }
}
