import type { TextCodec } from '@paradoxlab/utils'

export type OtbmHeader = {
  /** The 4 bytes before the root node, little-endian (0 in every known map). */
  readonly identifier: number
  /** Raw header field: 0 is OTBM v1, 3 is OTBM v4. */
  readonly version: number
  readonly width: number
  readonly height: number
  readonly otbMajor: number
  readonly otbMinor: number
  /** Type byte of the root node: 0 for RME and the toolkit, 1 for some older editors. */
  readonly rootType: number
  readonly tail: Uint8Array | null
}

export type OtbmMapDataAttribute =
  | { readonly kind: 'description'; readonly value: string }
  | { readonly kind: 'spawnFile'; readonly value: string }
  | { readonly kind: 'houseFile'; readonly value: string }
  | { readonly kind: 'unknown'; readonly bytes: Uint8Array }

export type OtbmMapData = {
  /** In file order; an `unknown` attribute, when present, is the last one. */
  readonly attributes: readonly OtbmMapDataAttribute[]
}

/**
 * - `node`: an item node.
 * - `inline`: a sid in the tile's ITEM attribute; never has attributes.
 * - `node+inlineCount`: an OTBM v1 item node whose first attribute is a `count` stored as an untagged
 *   byte right after the sid.
 */
export type ItemForm = 'node' | 'inline' | 'node+inlineCount'

export type OtbmItemAttribute =
  | { readonly kind: 'count'; readonly value: number }
  | { readonly kind: 'actionId'; readonly value: number }
  | { readonly kind: 'uniqueId'; readonly value: number }
  | { readonly kind: 'text'; readonly value: string }
  | { readonly kind: 'description'; readonly value: string }
  | { readonly kind: 'teleport'; readonly x: number; readonly y: number; readonly z: number }
  | { readonly kind: 'depotId'; readonly value: number }
  | { readonly kind: 'runeCharges'; readonly value: number }
  | { readonly kind: 'houseDoorId'; readonly value: number }
  | { readonly kind: 'duration'; readonly value: number }
  | { readonly kind: 'decayState'; readonly value: number }
  | { readonly kind: 'writtenDate'; readonly value: number }
  | { readonly kind: 'writtenBy'; readonly value: string }
  | { readonly kind: 'sleeperGuid'; readonly value: number }
  | { readonly kind: 'sleepStart'; readonly value: number }
  | { readonly kind: 'charges'; readonly value: number }
  /** Bytes from the first attribute the reader does not know to the end of the node. */
  | { readonly kind: 'unknown'; readonly bytes: Uint8Array }

export type OtbmTown = {
  readonly id: number
  readonly name: string
  readonly x: number
  readonly y: number
  readonly z: number
  readonly tail: Uint8Array | null
}

export type OtbmWaypoint = {
  readonly name: string
  readonly x: number
  readonly y: number
  readonly z: number
  readonly tail: Uint8Array | null
}

export type OtbmListKind = 'towns' | 'waypoints'

/** Structural signals only the reader can see; each is reported once, at the end, with a count. */
export type OtbmDiagnosticCode =
  | 'file-above-reference'
  | 'node-out-of-place'
  | 'tile-outside-area'
  | 'tile-attributes-out-of-order'
  | 'unknown-node'
  | 'area-properties-extra'
  | 'trailing-bytes'
  | 'possible-utf8-text'

export type OtbmDiagnostic = {
  readonly code: OtbmDiagnosticCode
  /** Byte offset of the first occurrence. */
  readonly offset: number
  readonly count: number
  readonly message: string
}

/**
 * The events of an OTBM in file order, with everything needed to write it back byte for byte. The
 * reader emits them and the encoder consumes them. Hot events (`tile`, `item`) take positional
 * arguments so reading allocates nothing per tile or per attribute-less item.
 */
export type OtbmVisitor = {
  header?(header: OtbmHeader): void
  mapData?(data: OtbmMapData): void
  mapDataEnd?(): void
  area?(x: number, y: number, z: number, tail: Uint8Array | null): void
  areaEnd?(): void
  /** `flags` is `null` when the tile has no flags attribute; a house tile may have house id 0. */
  tile?(
    x: number,
    y: number,
    z: number,
    flags: number | null,
    houseId: number | null,
    tail: Uint8Array | null
  ): void
  tileEnd?(): void
  /** `attributes` is `null` for an item without attributes; children follow until `itemEnd`. */
  item?(sid: number, form: ItemForm, attributes: readonly OtbmItemAttribute[] | null): void
  itemEnd?(): void
  list?(kind: OtbmListKind): void
  listEnd?(): void
  town?(town: OtbmTown): void
  waypoint?(waypoint: OtbmWaypoint): void
  /** A node the reader does not model, as its verbatim bytes from node start to node end. */
  unknownNode?(type: number, raw: Uint8Array): void
  diagnostic?(diagnostic: OtbmDiagnostic): void
  /** The root node closed; `trailing` holds any bytes after it. */
  end?(trailing: Uint8Array | null): void
}

/** Ceilings that stop reading or writing with an error: protection against corrupt or hostile files. */
export type OtbmLimits = {
  /** Above this, a `file-above-reference` diagnostic. */
  readonly fileWarnBytes: number
  readonly fileBytes: number
  readonly itemsPerTile: number
  readonly containerChildren: number
  readonly itemNesting: number
  /** Property bytes of one node, as stored (escape bytes included). */
  readonly nodePropertyBytes: number
}

export type OtbmOptions = {
  /** Codec of the map's strings (default windows-1252). */
  text?: TextCodec
  /** Required to read OTBM v1: whether a sid stores its count inline (see `inlineCountOf` in `@paradoxlab/otb`). */
  hasInlineCount?: (sid: number) => boolean
  limits?: Partial<OtbmLimits>
}

export type OtbmReadOptions = {
  onProgress?: (offset: number, total: number) => void
}

export type OtbmWriteStreamOptions = {
  /** A chunk is handed out once the buffer passes this size, at the next safe point. */
  chunkBytes?: number
  /** Writing stops with an error past this many bytes (default: the fatal file ceiling). */
  maxBytes?: number
}

export type OtbmEncoder = Required<OtbmVisitor> & {
  /** True once `end` was written. */
  readonly finished: boolean
}

/** Replays OTBM events; each step it yields is a point where the encoder may hand out a chunk. */
export type OtbmSource = {
  emit(visitor: OtbmVisitor): Iterable<void>
}

export type OtbmDocumentUnknown = { kind: 'unknown'; type: number; raw: Uint8Array }

export type OtbmDocumentItem = {
  kind: 'item'
  sid: number
  form: ItemForm
  attributes: OtbmItemAttribute[] | null
  /** `null` when the item holds nothing, which is almost always: no empty array per item. */
  children: OtbmDocumentNode[] | null
}

export type OtbmDocumentNode = OtbmDocumentItem | OtbmDocumentUnknown

export type OtbmDocumentTile = {
  kind: 'tile'
  x: number
  y: number
  z: number
  flags: number | null
  houseId: number | null
  tail: Uint8Array | null
  items: OtbmDocumentNode[]
}

export type OtbmDocumentArea = {
  kind: 'area'
  x: number
  y: number
  z: number
  tail: Uint8Array | null
  tiles: (OtbmDocumentTile | OtbmDocumentUnknown)[]
}

export type OtbmDocumentTown = { kind: 'town' } & OtbmTown
export type OtbmDocumentWaypoint = { kind: 'waypoint' } & OtbmWaypoint

export type OtbmDocumentList = {
  kind: 'list'
  list: OtbmListKind
  children: (OtbmDocumentTown | OtbmDocumentWaypoint | OtbmDocumentUnknown)[]
}

export type OtbmDocumentEntry = OtbmDocumentArea | OtbmDocumentList | OtbmDocumentUnknown

export type OtbmDocumentStats = {
  areas: number
  tiles: number
  items: number
}

/**
 * A whole OTBM as objects, built from OTBM events and replayed as the same events (it is an
 * `OtbmSource`), so writing it back is byte-identical. Meant for scripts, tools and small maps.
 */
export type OtbmDocument = OtbmSource & {
  header: OtbmHeader
  mapData: OtbmMapData
  /** Root children before the map data; only malformed maps have any. */
  beforeMapData: OtbmDocumentEntry[]
  entries: OtbmDocumentEntry[]
  /** Root children after the map data; only malformed maps have any. */
  afterMapData: OtbmDocumentEntry[]
  trailing: Uint8Array | null
  diagnostics: OtbmDiagnostic[]
  /** The tile at a position, from an index built at load (tiles added later are not indexed). */
  getTile(x: number, y: number, z: number): OtbmDocumentTile | undefined
  stats(): OtbmDocumentStats
}

/** A consumer's editable map, as seen by the composer. */
export type OtbmTileSource = {
  hasTile(x: number, y: number, z: number): boolean
  /** Emits `tile`, its items and `tileEnd` for the tile at the position; false when there is none. */
  emitTile(x: number, y: number, z: number, visitor: OtbmVisitor): boolean
  forEachTile(fn: (x: number, y: number, z: number) => void): void
}

export type SourceLayoutUnknown = {
  readonly kind: 'unknown'
  readonly type: number
  readonly raw: Uint8Array
}

export type SourceLayoutArea = {
  readonly kind: 'area'
  readonly x: number
  readonly y: number
  readonly z: number
  readonly tail: Uint8Array | null
  /** `(dx << 8) | dy` per tile, in file order. */
  readonly tiles: Uint16Array
  /** Unknown nodes among the tiles; `before` is the index of the tile they precede. */
  readonly unknown: readonly (SourceLayoutUnknown & { readonly before: number })[]
}

export type SourceLayoutList = {
  readonly kind: 'list'
  readonly list: OtbmListKind
  readonly towns: readonly OtbmTown[]
  readonly waypoints: readonly OtbmWaypoint[]
  /** Unknown nodes inside the list, written after its towns or waypoints. */
  readonly unknown: readonly SourceLayoutUnknown[]
}

export type SourceLayoutEntry = SourceLayoutArea | SourceLayoutList | SourceLayoutUnknown

/** Everything an OTBM holds besides tile contents, in file order. */
export type SourceLayout = {
  readonly header: OtbmHeader
  readonly mapData: OtbmMapData
  readonly beforeMapData: readonly SourceLayoutEntry[]
  readonly entries: readonly SourceLayoutEntry[]
  readonly afterMapData: readonly SourceLayoutEntry[]
  readonly trailing: Uint8Array | null
}

/** One semantic difference between two maps; `path` locates it (`tile 100,200,7 item 2 actionId`). */
export type OtbmDifference = {
  readonly path: string
  readonly a: unknown
  readonly b: unknown
}

export type OtbmCompareOptions = {
  /** Stop after this many differences (default 100). */
  limit?: number
}

/** OTBM versions a map can be upgraded to; v4 has no known differences to convert to. */
export type OtbmUpgradeTarget = 2 | 3

export type ComposeOptions = {
  /** `preserve` (default) keeps the source layout; `canonical` writes every tile in areas by z, y, x. */
  layout?: 'preserve' | 'canonical'
  /** Replace the towns of the source layout. */
  towns?: readonly OtbmTown[]
  /** Replace the waypoints of the source layout. */
  waypoints?: readonly OtbmWaypoint[]
}
