import { createEscapedBinaryWriter } from '@paradoxlab/utils'
import type { EscapedBinaryWriter } from '@paradoxlab/utils'
import { NODE_SPECIAL_BYTE, OTBM_ATTRIBUTE, OTBM_NODE_TYPE } from './otbm-config.js'
import type {
  OtbmItem,
  OtbmTile,
  OtbmTileArea,
  OtbmTown,
  OtbmWaypoint,
  OtbmWriteInput
} from './types.js'

const { START, END } = NODE_SPECIAL_BYTE

function validateSid(sid: number): void {
  if (!Number.isInteger(sid) || sid <= 0) {
    throw new RangeError(`Invalid item sid: ${sid} (must be a positive integer)`)
  }
}

function isCompact(item: OtbmItem): boolean {
  return (
    item.count === undefined &&
    item.actionId === undefined &&
    item.uniqueId === undefined &&
    item.text === undefined &&
    item.writtenBy === undefined &&
    item.writtenDate === undefined &&
    item.destX === undefined &&
    item.destY === undefined &&
    item.destZ === undefined &&
    item.depotId === undefined &&
    item.charges === undefined &&
    item.houseDoor === undefined &&
    item.duration === undefined &&
    item.decayState === undefined &&
    (item.children === undefined || item.children.length === 0)
  )
}

// Writes a complete ITEM node (0xFE 0x06 ... 0xFF). Used for non-compact tile items
// and for all item children - the 0x09 inline-item tile attribute is only valid in
// tile props context, never inside another ITEM node.
function writeItemNode(w: EscapedBinaryWriter, item: OtbmItem): void {
  validateSid(item.sid)

  w.u8(START)
  w.u8(OTBM_NODE_TYPE.ITEM)
  w.escU16(item.sid)

  if (item.count !== undefined) {
    w.escU8(OTBM_ATTRIBUTE.COUNT)
    w.escU8(item.count)
  }
  if (item.actionId !== undefined) {
    w.escU8(OTBM_ATTRIBUTE.ACTION_ID)
    w.escU16(item.actionId)
  }
  if (item.uniqueId !== undefined) {
    w.escU8(OTBM_ATTRIBUTE.UNIQUE_ID)
    w.escU16(item.uniqueId)
  }
  if (item.text !== undefined) {
    w.escU8(OTBM_ATTRIBUTE.TEXT)
    w.escStr(item.text)
  }
  if (item.depotId !== undefined) {
    w.escU8(OTBM_ATTRIBUTE.DEPOT_ID)
    w.escU16(item.depotId)
  }
  if (item.charges !== undefined) {
    w.escU8(OTBM_ATTRIBUTE.CHARGES)
    w.escU16(item.charges)
  }
  if (item.houseDoor !== undefined) {
    w.escU8(OTBM_ATTRIBUTE.HOUSE_DOOR)
    w.escU8(item.houseDoor)
  }
  if (item.duration !== undefined) {
    w.escU8(OTBM_ATTRIBUTE.DURATION)
    w.escU32(item.duration)
  }
  if (item.decayState !== undefined) {
    w.escU8(OTBM_ATTRIBUTE.DECAY_STATE)
    w.escU8(item.decayState)
  }
  if (item.writtenDate !== undefined) {
    w.escU8(OTBM_ATTRIBUTE.WRITTEN_DATE)
    w.escU32(item.writtenDate)
  }
  if (item.writtenBy !== undefined) {
    w.escU8(OTBM_ATTRIBUTE.WRITTEN_BY)
    w.escStr(item.writtenBy)
  }
  if (item.destX !== undefined && item.destY !== undefined && item.destZ !== undefined) {
    w.escU8(OTBM_ATTRIBUTE.TELE_DEST)
    w.escU16(item.destX)
    w.escU16(item.destY)
    w.escU8(item.destZ)
  }

  for (const child of item.children ?? []) {
    writeItemNode(w, child)
  }

  w.u8(END)
}

function serializeTile(w: EscapedBinaryWriter, tile: OtbmTile, area: OtbmTileArea): void {
  const offsetX = tile.x - area.baseX
  const offsetY = tile.y - area.baseY

  if (offsetX > 255 || offsetY > 255) {
    throw new RangeError(
      `Tile offset out of range: tile (${tile.x},${tile.y}) exceeds area base (${area.baseX},${area.baseY}) by more than 255`
    )
  }

  w.u8(START)
  w.u8(tile.kind === 'house' ? OTBM_NODE_TYPE.HOUSETILE : OTBM_NODE_TYPE.TILE)

  w.escU8(offsetX)
  w.escU8(offsetY)

  if (tile.kind === 'house') w.escU32(tile.houseId)

  if (tile.flags !== 0) {
    w.escU8(OTBM_ATTRIBUTE.TILE_FLAGS)
    w.escU32(tile.flags)
  }

  if (tile.actionId !== undefined) {
    w.escU8(OTBM_ATTRIBUTE.ACTION_ID)
    w.escU16(tile.actionId)
  }

  // compact items written inline as tile attribute 0x09 u16(sid)
  for (const item of tile.items) {
    if (isCompact(item)) {
      validateSid(item.sid)
      w.escU8(OTBM_ATTRIBUTE.ITEM)
      w.escU16(item.sid)
    }
  }

  // non-compact items written as child ITEM nodes
  for (const item of tile.items) {
    if (!isCompact(item)) {
      writeItemNode(w, item)
    }
  }

  w.u8(END)
}

function serializeTown(w: EscapedBinaryWriter, town: OtbmTown): void {
  w.u8(START)
  w.u8(OTBM_NODE_TYPE.TOWN)
  w.escU32(town.id)
  w.escStr(town.name)
  w.escU16(town.x)
  w.escU16(town.y)
  w.escU8(town.z)
  w.u8(END)
}

function serializeWaypoint(w: EscapedBinaryWriter, wp: OtbmWaypoint): void {
  w.u8(START)
  w.u8(OTBM_NODE_TYPE.WAYPOINT)
  w.escStr(wp.name)
  w.escU16(wp.x)
  w.escU16(wp.y)
  w.escU8(wp.z)
  w.u8(END)
}

function serializeHeaderChunk(data: OtbmWriteInput): Uint8Array {
  const w = createEscapedBinaryWriter()

  w.u32(0) // magic

  w.u8(START)
  w.u8(OTBM_NODE_TYPE.WORLD_NODE)
  w.escU32(2) // always v2
  w.escU16(data.header.width)
  w.escU16(data.header.height)
  w.escU32(data.header.majorVersion)
  w.escU32(data.header.minorVersion)

  w.u8(START)
  w.u8(OTBM_NODE_TYPE.MAP_DATA)

  return w.finish()
}

function serializeAreaChunk(area: OtbmTileArea): Uint8Array {
  const w = createEscapedBinaryWriter()

  w.u8(START)
  w.u8(OTBM_NODE_TYPE.TILE_AREA)
  w.escU16(area.baseX)
  w.escU16(area.baseY)
  w.escU8(area.baseZ)

  for (const tile of area.tiles) {
    serializeTile(w, tile, area)
  }

  w.u8(END)
  return w.finish()
}

function serializeFooterChunk(data: OtbmWriteInput): Uint8Array {
  const w = createEscapedBinaryWriter()

  w.u8(START)
  w.u8(OTBM_NODE_TYPE.TOWNS)
  for (const town of data.towns) {
    serializeTown(w, town)
  }
  w.u8(END)

  w.u8(START)
  w.u8(OTBM_NODE_TYPE.WAYPOINTS)
  for (const wp of data.waypoints) {
    serializeWaypoint(w, wp)
  }
  w.u8(END)

  w.u8(END) // END MAP_DATA
  w.u8(END) // END WORLD_NODE

  return w.finish()
}

export function serializeOtbm(
  data: OtbmWriteInput,
  onArea?: (index: number, total: number) => void
): Uint8Array[] {
  const chunks: Uint8Array[] = [serializeHeaderChunk(data)]

  const total = data.areas.length
  for (let i = 0; i < total; i++) {
    chunks.push(serializeAreaChunk(data.areas[i]!))
    onArea?.(i, total)
  }

  chunks.push(serializeFooterChunk(data))

  return chunks
}
