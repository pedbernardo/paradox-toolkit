import { ParseError } from '@paradox/utils'
import type { EscapedSliceReader } from '@paradox/utils'
import {
  NODE_SPECIAL_BYTE,
  OTBM_NODE_TYPE,
  TILE_KEY_Y_STRIDE,
  TILE_KEY_Z_STRIDE
} from './otbm-config.js'
import { parseItemAttrs, parseTileAttrs } from './otbm-attributes.js'
import type {
  OtbLookup,
  OtbmHeader,
  OtbmHouseTile,
  OtbmItem,
  OtbmRegularTile,
  OtbmStats,
  OtbmTile,
  OtbmTileArea,
  OtbmTown,
  OtbmWaypoint
} from './types.js'

const { START, END, ESCAPE } = NODE_SPECIAL_BYTE

export function countTileAreas(bytes: Uint8Array): number {
  let count = 0
  let d = -1
  let i = 4

  while (i < bytes.length) {
    const b = bytes[i]!
    if (b === ESCAPE) {
      i += 2
      continue
    }
    if (b === START) {
      i++
      if (i < bytes.length) {
        const type = bytes[i++]!
        d++
        if (d === 2 && type === OTBM_NODE_TYPE.TILE_AREA) count++
      }
      continue
    }
    if (b === END) {
      d--
      i++
      continue
    }
    i++
  }

  return count
}

export class OtbmStreamParser {
  header: OtbmHeader | null = null
  readonly areas: OtbmTileArea[] = []
  readonly tileMap = new Map<number, OtbmTile>()
  readonly towns: OtbmTown[] = []
  readonly waypoints: OtbmWaypoint[] = []
  readonly stats: OtbmStats = {
    areas: 0,
    tiles: 0,
    houseTiles: 0,
    items: 0,
    nestedItems: 0,
    towns: 0,
    waypoints: 0
  }

  // context stack - parallel Int32Arrays, no heap allocation per node
  // ctxPropsBegin[d] == -1 means props at depth d were already processed
  private readonly ctxType = new Int32Array(16)
  private readonly ctxPropsBegin = new Int32Array(16)
  private depth = -1

  // parse state
  private strict = false
  private currentArea: OtbmTileArea | null = null
  private currentTile: OtbmTile | null = null
  private currentTileKey = 0
  private readonly itemStack: OtbmItem[] = []

  // progress tracking
  private totalAreas = 0
  private areasDone = 0

  constructor(
    private readonly bytes: Uint8Array,
    private readonly sliceReader: EscapedSliceReader,
    private readonly otbLookup: OtbLookup | undefined,
    private readonly onProgress: ((pct: number) => void) | undefined
  ) {}

  run(): void {
    this.totalAreas = this.onProgress ? countTileAreas(this.bytes) : 0

    const bytes = this.bytes
    let i = 4
    while (i < bytes.length) {
      const b = bytes[i]!

      if (b === ESCAPE) {
        i += 2
        continue
      }

      if (b === START) {
        this.finalizeProps(i)
        i++
        if (i >= bytes.length) throw new ParseError('Unexpected EOF after node start (0xFE)')
        const type = bytes[i++]!
        this.depth++
        this.ctxType[this.depth] = type
        this.ctxPropsBegin[this.depth] = i
        continue
      }

      if (b === END) {
        this.finalizeProps(i)
        i++
        this.onNodeClose()
        this.depth--
        continue
      }

      i++
    }
  }

  private finalizeProps(pos: number): void {
    const depth = this.depth
    if (depth >= 0 && this.ctxPropsBegin[depth] !== -1) {
      this.processProps(this.ctxType[depth]!, this.ctxPropsBegin[depth]!, pos)
      this.ctxPropsBegin[depth] = -1
    }
  }

  private processProps(type: number, begin: number, end: number): void {
    if (this.depth === 0) {
      if (end - begin < 16) {
        throw new ParseError(
          `Root node props too short for OTBM header (got ${end - begin}, need 16)`
        )
      }
      const sliceReader = this.sliceReader
      sliceReader.seekWindow(begin, end)
      const version = sliceReader.u32()
      const width = sliceReader.u16()
      const height = sliceReader.u16()
      const majorVersion = sliceReader.u32()
      const minorVersion = sliceReader.u32()
      this.header = { version, width, height, majorVersion, minorVersion }
      if (version === 0 && !this.otbLookup) {
        throw new ParseError(
          'OtbLookup is required for OTBM version 0 - provide an OtbLookup instance'
        )
      }
      this.strict = version >= 1
      return
    }

    const sliceReader = this.sliceReader
    switch (type) {
      case OTBM_NODE_TYPE.TILE_AREA: {
        sliceReader.seekWindow(begin, end)
        const baseX = sliceReader.u16()
        const baseY = sliceReader.u16()
        const baseZ = sliceReader.u8()
        this.currentArea = { baseX, baseY, baseZ, tiles: [] }
        break
      }

      case OTBM_NODE_TYPE.TILE:
      case OTBM_NODE_TYPE.HOUSETILE: {
        if (this.currentArea === null) return
        sliceReader.seekWindow(begin, end)
        const offsetX = sliceReader.u8()
        const offsetY = sliceReader.u8()
        const area = this.currentArea
        const x = area.baseX + offsetX
        const y = area.baseY + offsetY
        const z = area.baseZ
        this.currentTileKey = x + y * TILE_KEY_Y_STRIDE + z * TILE_KEY_Z_STRIDE
        const items: OtbmItem[] = []
        if (type === OTBM_NODE_TYPE.HOUSETILE) {
          const houseId = sliceReader.u32()
          this.currentTile = { kind: 'house', x, y, z, houseId, flags: 0, items } as OtbmHouseTile
        } else {
          this.currentTile = { kind: 'tile', x, y, z, flags: 0, items } as OtbmRegularTile
        }
        parseTileAttrs(sliceReader, this.currentTile, this.strict)
        if (!this.strict && this.otbLookup) {
          for (const item of this.currentTile.items) {
            const resolved = this.otbLookup.getBySid(item.sid)
            if (resolved !== undefined) item.cid = resolved.cid
          }
        }
        break
      }

      case OTBM_NODE_TYPE.ITEM: {
        sliceReader.seekWindow(begin, end)
        const sid = sliceReader.u16()
        const item: OtbmItem = { sid }
        if (!this.strict && this.otbLookup) {
          const resolved = this.otbLookup.getBySid(sid)
          if (resolved !== undefined) item.cid = resolved.cid
        }
        parseItemAttrs(sliceReader, item, this.strict)
        this.itemStack.push(item)
        break
      }

      case OTBM_NODE_TYPE.TOWN: {
        sliceReader.seekWindow(begin, end)
        const id = sliceReader.u32()
        const nameLen = sliceReader.u16()
        const name = sliceReader.str(nameLen)
        const x = sliceReader.u16()
        const y = sliceReader.u16()
        const z = sliceReader.u8()
        this.towns.push({ id, name, x, y, z })
        this.stats.towns++
        break
      }

      case OTBM_NODE_TYPE.WAYPOINT: {
        if (this.header === null || this.header.version < 2) break
        sliceReader.seekWindow(begin, end)
        const nameLen = sliceReader.u16()
        const name = sliceReader.str(nameLen)
        const x = sliceReader.u16()
        const y = sliceReader.u16()
        const z = sliceReader.u8()
        this.waypoints.push({ name, x, y, z })
        this.stats.waypoints++
        break
      }
    }
  }

  private onNodeClose(): void {
    const type = this.ctxType[this.depth]!
    const stats = this.stats
    switch (type) {
      case OTBM_NODE_TYPE.TILE_AREA: {
        this.areas.push(this.currentArea!)
        stats.areas++
        this.areasDone++
        this.onProgress?.(Math.min(1, this.areasDone / this.totalAreas))
        this.currentArea = null
        break
      }

      case OTBM_NODE_TYPE.TILE:
      case OTBM_NODE_TYPE.HOUSETILE: {
        if (this.currentTile === null) break
        const tile = this.currentTile
        this.currentArea!.tiles.push(tile)
        this.tileMap.set(this.currentTileKey, tile)
        stats.tiles++
        if (tile.kind === 'house') stats.houseTiles++
        stats.items += tile.items.length
        this.currentTile = null
        break
      }

      case OTBM_NODE_TYPE.ITEM: {
        const item = this.itemStack.pop()!
        if (this.itemStack.length > 0) {
          const parent = this.itemStack[this.itemStack.length - 1]!
          if (parent.children === undefined) parent.children = []
          parent.children.push(item)
          stats.nestedItems++
        } else {
          this.currentTile!.items.push(item)
        }
        break
      }
    }
  }
}
