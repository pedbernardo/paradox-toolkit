import { ParseError, windows1252 } from '@paradoxlab/utils'
import type { TextCodec } from '@paradoxlab/utils'
import { ITEM_ATTRIBUTE_BY_ID } from './otbm-attributes.js'
import type { AttributeReader } from './otbm-attributes.js'
import {
  NODE_SPECIAL_BYTE,
  OTBM_ATTRIBUTE,
  OTBM_NODE_TYPE,
  checkFileSize,
  resolveLimits
} from './otbm-config.js'
import type {
  ItemForm,
  OtbmDiagnosticCode,
  OtbmItemAttribute,
  OtbmLimits,
  OtbmMapDataAttribute,
  OtbmOptions,
  OtbmReadOptions,
  OtbmVisitor
} from './types.js'

const { START, END, ESCAPE } = NODE_SPECIAL_BYTE
/** Nodes above the items: root, map data, area, tile. */
const STRUCTURE_DEPTH = 4

const Kind = {
  None: -1,
  Unknown: -2,
  Root: 0,
  MapData: 1,
  Area: 2,
  Tile: 3,
  Item: 4,
  Towns: 5,
  Waypoints: 6,
  Town: 7,
  Waypoint: 8
} as const

const KNOWN_TYPES = new Set<number>(Object.values(OTBM_NODE_TYPE))
const strictUtf8 = new TextDecoder('utf-8', { fatal: true })

function looksLikeUtf8(bytes: Uint8Array): boolean {
  if (!bytes.some((b) => b >= 0x80)) return false
  try {
    strictUtf8.decode(bytes)
    return true
  } catch {
    return false
  }
}

/** Counts each diagnostic code with its first offset, and reports them all once at the end. */
class DiagnosticLog {
  private readonly entries = new Map<
    OtbmDiagnosticCode,
    { offset: number; count: number; message: string }
  >()

  add(code: OtbmDiagnosticCode, offset: number, message: string): void {
    const entry = this.entries.get(code)
    if (entry === undefined) this.entries.set(code, { offset, count: 1, message })
    else entry.count++
  }

  report(visitor: OtbmVisitor): void {
    for (const [code, { offset, count, message }] of this.entries) {
      visitor.diagnostic?.({ code, offset, count, message })
    }
  }
}

/** The offset right after the node that starts at `start`, children included. */
function nodeEnd(bytes: Uint8Array, start: number): number {
  let depth = 0
  let i = start
  while (i < bytes.length) {
    const b = bytes[i]
    if (b === ESCAPE) {
      i += 2
    } else if (b === START) {
      depth++
      i += 2
    } else if (b === END) {
      i++
      if (--depth === 0) return i
    } else {
      i++
    }
  }
  throw new ParseError(`OTBM ends inside the node that starts at offset ${start}`)
}

function classifyMapChild(type: number): number {
  if (type === OTBM_NODE_TYPE.TILE_AREA) return Kind.Area
  if (type === OTBM_NODE_TYPE.TOWNS) return Kind.Towns
  if (type === OTBM_NODE_TYPE.WAYPOINTS) return Kind.Waypoints
  return Kind.Unknown
}

/** What a node of `type` is under a parent of `parent` kind; `Unknown` is kept as raw bytes. */
function classify(parent: number, type: number): number {
  switch (parent) {
    case Kind.None:
      return Kind.Root
    case Kind.Root:
      // Areas and lists under the root are out of place but self-contained: read them in place.
      return type === OTBM_NODE_TYPE.MAP_DATA ? Kind.MapData : classifyMapChild(type)
    case Kind.MapData:
      return classifyMapChild(type)
    case Kind.Area:
      return type === OTBM_NODE_TYPE.TILE || type === OTBM_NODE_TYPE.HOUSETILE
        ? Kind.Tile
        : Kind.Unknown
    case Kind.Tile:
    case Kind.Item:
      return type === OTBM_NODE_TYPE.ITEM ? Kind.Item : Kind.Unknown
    case Kind.Towns:
      return type === OTBM_NODE_TYPE.TOWN ? Kind.Town : Kind.Unknown
    case Kind.Waypoints:
      return type === OTBM_NODE_TYPE.WAYPOINT ? Kind.Waypoint : Kind.Unknown
    default:
      return Kind.Unknown
  }
}

/**
 * Reads an OTBM in one pass, reporting it as OTBM events. Node properties are read in place from
 * the file (or from an unescaped copy when they hold an escape byte); nothing is allocated per
 * tile or per attribute-less item.
 */
export class OtbmStreamParser implements AttributeReader {
  // Context stack: parallel typed arrays, no allocation per node. ctxPropsBegin[d] is -1 once the
  // properties at depth d were processed (they end at the first child or at the node end).
  private readonly ctxType: Int32Array
  private readonly ctxKind: Int32Array
  private readonly ctxPropsBegin: Int32Array
  private readonly ctxChildren: Int32Array
  /** 1 when the properties at that depth hold an escape byte, so they must be unescaped first. */
  private readonly ctxEscaped: Uint8Array
  private depth = -1
  private i = 4

  private readonly fileView: DataView
  private scratch = new Uint8Array(4096)
  private scratchView = new DataView(this.scratch.buffer)
  // Properties are read from `src` between `pos` and `end`.
  private src: Uint8Array
  private view: DataView
  private pos = 0
  private end = 0
  private nodeOffset = 0

  private readonly text: TextCodec
  private readonly checksUtf8: boolean
  private readonly hasInlineCount: ((sid: number) => boolean) | undefined
  private readonly limits: OtbmLimits
  private readonly log = new DiagnosticLog()
  private readonly onProgress: ((offset: number, total: number) => void) | undefined
  private readonly inlineSids: number[] = []
  private version = -1
  private areaX = 0
  private areaY = 0
  private areaZ = 0
  private itemDepth = 0
  private itemsInTile = 0

  constructor(
    private readonly bytes: Uint8Array,
    private readonly visitor: OtbmVisitor,
    options: OtbmOptions = {},
    readOptions: OtbmReadOptions = {}
  ) {
    if (bytes.length < 6 || bytes[4] !== START) {
      throw new ParseError('Not an OTBM file: expected a node start at offset 4')
    }
    this.limits = resolveLimits(options.limits)
    if (checkFileSize(bytes.length, this.limits)) {
      this.log.add(
        'file-above-reference',
        0,
        `OTBM of ${bytes.length} bytes is larger than any known map`
      )
    }
    const maxDepth = STRUCTURE_DEPTH + this.limits.itemNesting + 1
    this.ctxType = new Int32Array(maxDepth)
    this.ctxKind = new Int32Array(maxDepth)
    this.ctxPropsBegin = new Int32Array(maxDepth)
    this.ctxChildren = new Int32Array(maxDepth)
    this.ctxEscaped = new Uint8Array(maxDepth)
    this.text = options.text ?? windows1252
    this.checksUtf8 = this.text.name !== 'utf-8'
    this.hasInlineCount = options.hasInlineCount
    this.onProgress = readOptions.onProgress
    this.fileView = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    this.src = bytes
    this.view = this.fileView
  }

  /** Reads until the next tile area closes (true) or the map ends (false). */
  step(): boolean {
    const bytes = this.bytes
    const n = bytes.length
    let i = this.i
    while (i < n) {
      const b = bytes[i]!
      if (b === ESCAPE) {
        this.ctxEscaped[this.depth] = 1
        i += 2
        continue
      }
      if (b === START) {
        this.finalizeProps(i)
        const type = bytes[i + 1]!
        const parent = this.depth < 0 ? Kind.None : this.ctxKind[this.depth]!
        const kind = classify(parent, type)
        const isList = kind === Kind.Towns || kind === Kind.Waypoints
        const afterType = bytes[i + 2]
        const hasProperties = afterType !== START && afterType !== END
        const isListWithProperties = isList && hasProperties
        if (kind === Kind.Unknown || isListWithProperties) {
          i = this.keepUnknown(i, type, parent)
          continue
        }
        if (parent === Kind.Root && kind !== Kind.MapData) {
          this.log.add(
            'node-out-of-place',
            i,
            `Node type ${type} outside the map data, read in place`
          )
        }
        if (kind === Kind.Item) this.enterItem(parent, i)
        const depth = ++this.depth
        this.ctxType[depth] = type
        this.ctxKind[depth] = kind
        this.ctxPropsBegin[depth] = i + 2
        this.ctxEscaped[depth] = 0
        this.ctxChildren[depth] = 0
        this.nodeOffset = i
        i += 2
        continue
      }
      if (b === END) {
        if (this.depth < 0) throw new ParseError(`Node end without a node start at offset ${i}`)
        this.finalizeProps(i)
        i++
        const kind = this.ctxKind[this.depth--]!
        if (kind === Kind.Item) this.itemDepth--
        // After a node ends, only another node or the parent's end may follow: a property byte
        // here would belong to no node.
        const next = bytes[i]
        const isStray = this.depth >= 0 && next !== START && next !== END
        if (isStray) throw new ParseError(`Unexpected byte between nodes at offset ${i}`)
        if (this.onNodeClose(kind, i)) {
          this.i = i
          if (kind === Kind.Area && this.onProgress !== undefined) this.onProgress(i, n)
          return kind === Kind.Area
        }
        continue
      }
      i++
    }
    throw new ParseError('OTBM ends with open nodes')
  }

  /** Emits a node the reader does not model, verbatim; returns the offset after it. */
  private keepUnknown(start: number, type: number, parent: number): number {
    const end = nodeEnd(this.bytes, start)
    const isTile = type === OTBM_NODE_TYPE.TILE || type === OTBM_NODE_TYPE.HOUSETILE
    if (isTile && parent !== Kind.Area) {
      this.log.add('tile-outside-area', start, 'Tile outside a tile area, kept as is')
    } else if (KNOWN_TYPES.has(type)) {
      this.log.add(
        'node-out-of-place',
        start,
        `Node type ${type} in an unexpected place, kept as is`
      )
    } else {
      this.log.add('unknown-node', start, `Unknown node type ${type}, kept as is`)
    }
    this.visitor.unknownNode?.(type, this.bytes.slice(start, end))
    return end
  }

  /** Counts an item against the ceilings before it is opened. */
  private enterItem(parent: number, offset: number): void {
    const limits = this.limits
    if (parent === Kind.Tile) {
      if (++this.itemsInTile > limits.itemsPerTile) {
        throw new ParseError(`Tile with more than ${limits.itemsPerTile} items at offset ${offset}`)
      }
    } else if (++this.ctxChildren[this.depth]! > limits.containerChildren) {
      throw new ParseError(
        `Container with more than ${limits.containerChildren} items at offset ${offset}`
      )
    }
    if (++this.itemDepth > limits.itemNesting) {
      throw new ParseError(`Items nested more than ${limits.itemNesting} deep at offset ${offset}`)
    }
  }

  private finalizeProps(end: number): void {
    const depth = this.depth
    if (depth < 0) return
    const begin = this.ctxPropsBegin[depth]!
    if (begin === -1) return
    this.ctxPropsBegin[depth] = -1
    if (end - begin > this.limits.nodePropertyBytes) {
      throw new ParseError(
        `Node at offset ${begin - 2} has more than ${this.limits.nodePropertyBytes} property bytes`
      )
    }
    this.window(begin, end, this.ctxEscaped[depth] === 1)
    switch (this.ctxKind[depth]) {
      case Kind.Item: {
        // Most items are a bare sid: keep that path small enough to stay inlined.
        const sid = this.u16()
        if (this.pos < this.end) return this.openItemWithAttributes(sid)
        return this.visitor.item?.(sid, 'node', null)
      }
      case Kind.Tile: {
        const x = this.areaX + this.u8()
        const y = this.areaY + this.u8()
        const houseId = this.ctxType[depth] === OTBM_NODE_TYPE.HOUSETILE ? this.u32() : null
        this.itemsInTile = 0
        if (this.pos < this.end) return this.openTileWithAttributes(x, y, houseId)
        return this.visitor.tile?.(x, y, this.areaZ, null, houseId, null)
      }
      case Kind.Area:
        return this.openArea()
      case Kind.Root:
        return this.openRoot(begin)
      case Kind.MapData:
        return this.openMapData()
      case Kind.Towns:
        return this.visitor.list?.('towns')
      case Kind.Waypoints:
        return this.visitor.list?.('waypoints')
      case Kind.Town:
        return this.openTown()
      case Kind.Waypoint:
        return this.openWaypoint()
    }
  }

  /** Emits the closing event; true when the caller must stop (an area closed or the map ended). */
  private onNodeClose(kind: number, next: number): boolean {
    const visitor = this.visitor
    switch (kind) {
      case Kind.Item:
        visitor.itemEnd?.()
        return false
      case Kind.Tile:
        visitor.tileEnd?.()
        return false
      case Kind.Area:
        visitor.areaEnd?.()
        return true
      case Kind.MapData:
        visitor.mapDataEnd?.()
        return false
      case Kind.Towns:
      case Kind.Waypoints:
        visitor.listEnd?.()
        return false
      case Kind.Root: {
        const trailing = next < this.bytes.length ? this.bytes.slice(next) : null
        if (trailing !== null) {
          this.log.add(
            'trailing-bytes',
            next,
            `${trailing.length} bytes after the root node, kept as is`
          )
        }
        this.log.report(visitor)
        visitor.end?.(trailing)
        this.onProgress?.(this.bytes.length, this.bytes.length)
        return true
      }
      default:
        return false
    }
  }

  private window(begin: number, end: number, escaped: boolean): void {
    if (!escaped) {
      this.src = this.bytes
      this.view = this.fileView
      this.pos = begin
      this.end = end
      return
    }
    if (end - begin > this.scratch.length) {
      this.scratch = new Uint8Array(Math.max(end - begin, this.scratch.length * 2))
      this.scratchView = new DataView(this.scratch.buffer)
    }
    const bytes = this.bytes
    const scratch = this.scratch
    let length = 0
    for (let j = begin; j < end; j++) {
      const b = bytes[j]!
      scratch[length++] = b === ESCAPE ? bytes[++j]! : b
    }
    this.src = scratch
    this.view = this.scratchView
    this.pos = 0
    this.end = length
  }

  private truncated(): never {
    throw new ParseError(`Node at offset ${this.nodeOffset} ends before its properties do`)
  }

  u8(): number {
    if (this.pos + 1 > this.end) this.truncated()
    return this.src[this.pos++]!
  }

  u16(): number {
    if (this.pos + 2 > this.end) this.truncated()
    const value = this.view.getUint16(this.pos, true)
    this.pos += 2
    return value
  }

  u32(): number {
    if (this.pos + 4 > this.end) this.truncated()
    const value = this.view.getUint32(this.pos, true)
    this.pos += 4
    return value
  }

  str(): string {
    const size = this.u16()
    if (this.pos + size > this.end) this.truncated()
    const raw = this.src.subarray(this.pos, this.pos + size)
    this.pos += size
    if (this.checksUtf8 && looksLikeUtf8(raw)) {
      this.log.add('possible-utf8-text', this.nodeOffset, 'Strings that look like UTF-8 text')
    }
    return this.text.decode(raw)
  }

  private rest(): Uint8Array | null {
    if (this.pos >= this.end) return null
    const tail = this.src.slice(this.pos, this.end)
    this.pos = this.end
    return tail
  }

  private openRoot(begin: number): void {
    if (this.end - this.pos < 16) {
      throw new ParseError(
        `OTBM header has ${this.end - this.pos} property bytes, expected at least 16`
      )
    }
    const bytes = this.bytes
    this.version = this.u32()
    const width = this.u16()
    const height = this.u16()
    const otbMajor = this.u32()
    const otbMinor = this.u32()
    if (this.version === 0 && this.hasInlineCount === undefined) {
      throw new ParseError(
        'OTBM v1 stores counts without a tag: pass `hasInlineCount` (inlineCountOf from @paradoxlab/otb)'
      )
    }
    this.visitor.header?.({
      identifier: (bytes[0]! | (bytes[1]! << 8) | (bytes[2]! << 16) | (bytes[3]! << 24)) >>> 0,
      version: this.version,
      width,
      height,
      otbMajor,
      otbMinor,
      rootType: bytes[begin - 1]!,
      tail: this.rest()
    })
  }

  private openMapData(): void {
    const attributes: OtbmMapDataAttribute[] = []
    while (this.pos < this.end) {
      const at = this.pos
      const id = this.u8()
      if (id === OTBM_ATTRIBUTE.DESCRIPTION)
        attributes.push({ kind: 'description', value: this.str() })
      else if (id === OTBM_ATTRIBUTE.SPAWN_FILE)
        attributes.push({ kind: 'spawnFile', value: this.str() })
      else if (id === OTBM_ATTRIBUTE.HOUSE_FILE)
        attributes.push({ kind: 'houseFile', value: this.str() })
      else {
        this.pos = at
        attributes.push({ kind: 'unknown', bytes: this.rest()! })
      }
    }
    this.visitor.mapData?.({ attributes })
  }

  private openArea(): void {
    this.areaX = this.u16()
    this.areaY = this.u16()
    this.areaZ = this.u8()
    const tail = this.rest()
    if (tail !== null) {
      this.log.add(
        'area-properties-extra',
        this.nodeOffset,
        'Tile areas with extra property bytes, kept as their tail'
      )
    }
    this.visitor.area?.(this.areaX, this.areaY, this.areaZ, tail)
  }

  private openTileWithAttributes(x: number, y: number, houseId: number | null): void {
    const visitor = this.visitor
    let flags: number | null = null
    let tail: Uint8Array | null = null
    const inlineSids = this.inlineSids
    inlineSids.length = 0
    while (this.pos < this.end) {
      const at = this.pos
      const id = this.u8()
      if (id === OTBM_ATTRIBUTE.TILE_FLAGS) {
        flags = this.u32()
      } else if (id === OTBM_ATTRIBUTE.ITEM) {
        inlineSids.push(this.u16())
      } else {
        this.pos = at
        tail = this.rest()
      }
    }
    if (inlineSids.length > this.limits.itemsPerTile) {
      throw new ParseError(
        `Tile with more than ${this.limits.itemsPerTile} items at offset ${this.nodeOffset}`
      )
    }
    this.itemsInTile = inlineSids.length
    visitor.tile?.(x, y, this.areaZ, flags, houseId, tail)
    for (let k = 0; k < inlineSids.length; k++) {
      visitor.item?.(inlineSids[k]!, 'inline', null)
      visitor.itemEnd?.()
    }
  }

  private openItemWithAttributes(sid: number): void {
    let form: ItemForm = 'node'
    const attributes: OtbmItemAttribute[] = []
    const storesCountInline = this.version === 0 && this.hasInlineCount!(sid)
    if (storesCountInline) {
      form = 'node+inlineCount'
      attributes.push({ kind: 'count', value: this.u8() })
    }
    while (this.pos < this.end) {
      const at = this.pos
      const spec = ITEM_ATTRIBUTE_BY_ID[this.u8()]
      if (spec === undefined) {
        // Attributes carry no length: from the first unknown one on, nothing can be parsed.
        this.pos = at
        attributes.push({ kind: 'unknown', bytes: this.rest()! })
        break
      }
      attributes.push(spec.read(this))
    }
    this.visitor.item?.(sid, form, attributes)
  }

  private openTown(): void {
    const id = this.u32()
    const name = this.str()
    this.visitor.town?.({ id, name, x: this.u16(), y: this.u16(), z: this.u8(), tail: this.rest() })
  }

  private openWaypoint(): void {
    const name = this.str()
    this.visitor.waypoint?.({ name, x: this.u16(), y: this.u16(), z: this.u8(), tail: this.rest() })
  }
}

/** The reader as steps: each yield is the end of a tile area, where a consumer may do other work. */
export function* readOtbmSteps(
  bytes: Uint8Array,
  visitor: OtbmVisitor,
  options: OtbmOptions = {},
  readOptions: OtbmReadOptions = {}
): Generator<void, void, undefined> {
  const parser = new OtbmStreamParser(bytes, visitor, options, readOptions)
  while (parser.step()) yield
}

export function readOtbm(
  bytes: Uint8Array,
  visitor: OtbmVisitor,
  options: OtbmOptions = {},
  readOptions: OtbmReadOptions = {}
): void {
  const parser = new OtbmStreamParser(bytes, visitor, options, readOptions)
  while (parser.step()) continue
}
