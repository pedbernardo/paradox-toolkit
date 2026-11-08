import type { OutputBuffer } from '@paradoxlab/utils'
import { ITEM_ATTRIBUTE_BY_KIND } from './otbm-attributes.js'
import { NODE_SPECIAL_BYTE, OTBM_ATTRIBUTE, OTBM_NODE_TYPE, resolveLimits } from './otbm-config.js'
import type {
  ItemForm,
  OtbmEncoder,
  OtbmHeader,
  OtbmItemAttribute,
  OtbmMapData,
  OtbmOptions,
  OtbmTown,
  OtbmWaypoint
} from './types.js'

const { START, END } = NODE_SPECIAL_BYTE

/** An event sequence the encoder cannot write: a programming error in the event source. */
export class OtbmEncodeError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'OtbmEncodeError'
  }
}

function writeHeader(w: OutputBuffer, header: OtbmHeader): void {
  w.u32(header.identifier)
  w.u8(START)
  w.u8(header.rootType)
  w.escU32(header.version)
  w.escU16(header.width)
  w.escU16(header.height)
  w.escU32(header.otbMajor)
  w.escU32(header.otbMinor)
  if (header.tail !== null) w.escBytes(header.tail)
}

function writeMapDataStart(w: OutputBuffer, data: OtbmMapData): void {
  w.u8(START)
  w.u8(OTBM_NODE_TYPE.MAP_DATA)
  const last = data.attributes.length - 1
  data.attributes.forEach((attribute, index) => {
    switch (attribute.kind) {
      case 'description':
        w.escU8(OTBM_ATTRIBUTE.DESCRIPTION)
        w.escStr(attribute.value)
        break
      case 'spawnFile':
        w.escU8(OTBM_ATTRIBUTE.SPAWN_FILE)
        w.escStr(attribute.value)
        break
      case 'houseFile':
        w.escU8(OTBM_ATTRIBUTE.HOUSE_FILE)
        w.escStr(attribute.value)
        break
      case 'unknown':
        if (index !== last)
          throw new OtbmEncodeError('An unknown attribute tail must be the last attribute')
        w.escBytes(attribute.bytes)
        break
    }
  })
}

function writeAreaStart(
  w: OutputBuffer,
  x: number,
  y: number,
  z: number,
  tail: Uint8Array | null
): void {
  w.u8(START)
  w.u8(OTBM_NODE_TYPE.TILE_AREA)
  w.escU16(x)
  w.escU16(y)
  w.escU8(z)
  if (tail !== null) w.escBytes(tail)
}

function writeTileStart(
  w: OutputBuffer,
  dx: number,
  dy: number,
  flags: number | null,
  houseId: number | null
): void {
  w.u8(START)
  w.u8(houseId === null ? OTBM_NODE_TYPE.TILE : OTBM_NODE_TYPE.HOUSETILE)
  w.escU8(dx)
  w.escU8(dy)
  if (houseId !== null) w.escU32(houseId)
  if (flags !== null) {
    w.escU8(OTBM_ATTRIBUTE.TILE_FLAGS)
    w.escU32(flags)
  }
}

function writeItemAttributes(
  w: OutputBuffer,
  attributes: readonly OtbmItemAttribute[],
  from: number
): void {
  const last = attributes.length - 1
  for (let i = from; i <= last; i++) {
    const attribute = attributes[i]!
    if (attribute.kind === 'unknown') {
      if (i !== last)
        throw new OtbmEncodeError('An unknown attribute tail must be the last attribute')
      w.escBytes(attribute.bytes)
      continue
    }
    const spec = ITEM_ATTRIBUTE_BY_KIND[attribute.kind]
    w.escU8(spec.id)
    spec.write(w, attribute as never)
  }
}

function writeTown(w: OutputBuffer, town: OtbmTown): void {
  w.u8(START)
  w.u8(OTBM_NODE_TYPE.TOWN)
  w.escU32(town.id)
  w.escStr(town.name)
  w.escU16(town.x)
  w.escU16(town.y)
  w.escU8(town.z)
  if (town.tail !== null) w.escBytes(town.tail)
  w.u8(END)
}

function writeWaypoint(w: OutputBuffer, waypoint: OtbmWaypoint): void {
  w.u8(START)
  w.u8(OTBM_NODE_TYPE.WAYPOINT)
  w.escStr(waypoint.name)
  w.escU16(waypoint.x)
  w.escU16(waypoint.y)
  w.escU8(waypoint.z)
  if (waypoint.tail !== null) w.escBytes(waypoint.tail)
  w.u8(END)
}

const Open = {
  Root: 0,
  MapData: 1,
  Area: 2,
  Tile: 3,
  Item: 4,
  InlineItem: 5,
  Towns: 6,
  Waypoints: 7
} as const

/**
 * Writes OTBM events to `output` exactly as they describe the file: it decides nothing about the
 * Shape and rejects sequences that would produce a malformed file.
 */
export function createOtbmEncoder(output: OutputBuffer, options: OtbmOptions = {}): OtbmEncoder {
  const limits = resolveLimits(options.limits)
  const hasInlineCount = options.hasInlineCount
  const open = new Int32Array(8 + limits.itemNesting)
  let depth = -1
  let version = -1
  let areaX = 0
  let areaY = 0
  let areaZ = 0
  // The tile node's properties stay open while inline items arrive; its tail goes after them.
  let tilePropsOpen = false
  let tileTail: Uint8Array | null = null
  let itemsInTile = 0
  let itemDepth = 0
  let finished = false

  const fail = (message: string): never => {
    throw new OtbmEncodeError(message)
  }
  const top = (): number => (depth < 0 ? -1 : open[depth]!)
  const push = (kind: number): void => {
    open[++depth] = kind
  }
  const expect = (kind: number, event: string): void => {
    if (top() !== kind) fail(`${event} is not allowed here`)
  }
  const expectMapLevel = (event: string): void => {
    const parent = top()
    if (parent !== Open.MapData && parent !== Open.Root) fail(`${event} is not allowed here`)
  }
  const closeTileProps = (): void => {
    if (!tilePropsOpen) return
    if (tileTail !== null) output.escBytes(tileTail)
    tileTail = null
    tilePropsOpen = false
  }
  const countTileItem = (): void => {
    if (++itemsInTile > limits.itemsPerTile)
      fail(`Tile with more than ${limits.itemsPerTile} items`)
  }

  /** A v1 node item whose sid stores its count inline is written with the count untagged. */
  const promotedToInlineCount = (
    sid: number,
    attributes: readonly OtbmItemAttribute[]
  ): readonly OtbmItemAttribute[] | null => {
    if (version !== 0 || hasInlineCount === undefined || !hasInlineCount(sid)) return null
    const count = attributes.find((attribute) => attribute.kind === 'count')
    if (count === undefined) return null
    return [count, ...attributes.filter((attribute) => attribute !== count)]
  }

  const openItemNode = (sid: number): void => {
    const parent = top()
    if (parent === Open.Tile) {
      closeTileProps()
      countTileItem()
    } else if (parent !== Open.Item) {
      fail('item is only allowed in a tile or an item')
    }
    if (++itemDepth > limits.itemNesting) fail(`Items nested more than ${limits.itemNesting} deep`)
    output.u8(START)
    output.u8(OTBM_NODE_TYPE.ITEM)
    output.escU16(sid)
    push(Open.Item)
  }

  return {
    get finished() {
      return finished
    },

    header(header) {
      if (depth >= 0 || finished) fail('header must be the first event')
      version = header.version
      writeHeader(output, header)
      push(Open.Root)
    },

    mapData(data) {
      expect(Open.Root, 'mapData')
      writeMapDataStart(output, data)
      push(Open.MapData)
    },

    mapDataEnd() {
      expect(Open.MapData, 'mapDataEnd')
      output.u8(END)
      depth--
    },

    area(x, y, z, tail) {
      expectMapLevel('area')
      areaX = x
      areaY = y
      areaZ = z
      writeAreaStart(output, x, y, z, tail)
      push(Open.Area)
    },

    areaEnd() {
      expect(Open.Area, 'areaEnd')
      output.u8(END)
      depth--
    },

    tile(x, y, z, flags, houseId, tail) {
      expect(Open.Area, 'tile')
      const dx = x - areaX
      const dy = y - areaY
      const isInsideArea = dx >= 0 && dx <= 0xff && dy >= 0 && dy <= 0xff && z === areaZ
      if (!isInsideArea)
        fail(`Tile ${x},${y},${z} is outside the area at ${areaX},${areaY},${areaZ}`)
      writeTileStart(output, dx, dy, flags, houseId)
      tilePropsOpen = true
      tileTail = tail
      itemsInTile = 0
      push(Open.Tile)
    },

    tileEnd() {
      expect(Open.Tile, 'tileEnd')
      closeTileProps()
      output.u8(END)
      depth--
    },

    item(sid: number, form: ItemForm, attributes: readonly OtbmItemAttribute[] | null) {
      // Fast path: most items are a bare sid.
      if (form === 'node' && attributes === null) {
        openItemNode(sid)
        return
      }
      if (form === 'inline') {
        const canBeInline = top() === Open.Tile && tilePropsOpen && attributes === null
        if (!canBeInline) {
          fail(`Item ${sid} cannot be inline: only attribute-less items before any node in a tile`)
        }
        countTileItem()
        output.escU8(OTBM_ATTRIBUTE.ITEM)
        output.escU16(sid)
        push(Open.InlineItem)
        return
      }
      const list =
        form === 'node' ? (promotedToInlineCount(sid, attributes!) ?? attributes!) : attributes
      const isInlineCount = form === 'node+inlineCount' || list !== attributes
      openItemNode(sid)
      if (isInlineCount) {
        if (version !== 0) fail(`Item ${sid}: an inline count only exists in OTBM v1`)
        const count = list?.[0]
        if (count?.kind !== 'count')
          fail(`Item ${sid}: an inline count needs a count as first attribute`)
        output.escU8((count as { value: number }).value)
        writeItemAttributes(output, list!, 1)
      } else if (list !== null) {
        writeItemAttributes(output, list, 0)
      }
    },

    itemEnd() {
      const kind = top()
      if (kind === Open.Item) {
        itemDepth--
        output.u8(END)
      } else if (kind !== Open.InlineItem) {
        fail('itemEnd without an open item')
      }
      depth--
    },

    list(kind) {
      expectMapLevel('list')
      output.u8(START)
      output.u8(kind === 'towns' ? OTBM_NODE_TYPE.TOWNS : OTBM_NODE_TYPE.WAYPOINTS)
      push(kind === 'towns' ? Open.Towns : Open.Waypoints)
    },

    listEnd() {
      const kind = top()
      if (kind !== Open.Towns && kind !== Open.Waypoints) fail('listEnd without an open list')
      output.u8(END)
      depth--
    },

    town(town) {
      expect(Open.Towns, 'town')
      writeTown(output, town)
    },

    waypoint(waypoint) {
      expect(Open.Waypoints, 'waypoint')
      writeWaypoint(output, waypoint)
    },

    unknownNode(_type, raw) {
      if (depth < 0) fail('unknownNode before header')
      closeTileProps()
      output.bytes(raw)
    },

    diagnostic() {},

    end(trailing) {
      expect(Open.Root, 'end')
      output.u8(END)
      if (trailing !== null) output.bytes(trailing)
      depth--
      finished = true
    }
  }
}
