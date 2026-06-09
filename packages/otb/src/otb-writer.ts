import { createEscapedBinaryWriter } from '@paradoxlab/utils'
import type { EscapedBinaryWriter } from '@paradoxlab/utils'
import { NODE_SPECIAL_BYTE, ROOT_NODE_ATTR, ITEM_GROUP, parseSchemaVersion } from './otb-config.js'
import { flagsToInt } from './otb-flags.js'
import { ITEM_ATTRIBUTE, encodeStr } from './otb-attributes.js'
import type { OtbItem, OtbWriteInput } from './types.js'
import { ParseError } from '@paradoxlab/utils'

export function serializeOtb(data: OtbWriteInput): Uint8Array {
  const { major, minor, build } = parseSchemaVersion(data.schemaVersion)
  validateWriteInput(data)

  const writer = createEscapedBinaryWriter()

  writer.bytes(new Uint8Array(4)) // magic
  writer.u8(NODE_SPECIAL_BYTE.START)
  writer.u8(0x00) // root group
  writer.escU32(0x00000000) // root flags
  writer.u8(ROOT_NODE_ATTR)
  writer.escU16(128) // dataLength
  writer.escU32(major)
  writer.escU32(minor)
  writer.escU32(build)
  writer.bytes(new Uint8Array(116)) // padding

  for (const item of data.items) {
    if (item.group === ITEM_GROUP.DEPRECATED) {
      // eslint-disable-next-line no-console
      console.warn(`OTB write: skipping deprecated item sid=${item.sid}`)
      continue
    }
    writer.u8(NODE_SPECIAL_BYTE.START)
    writer.u8(item.group)
    writer.escU32(flagsToInt(item.flags))
    writeAttrs(writer, item)
    writer.u8(NODE_SPECIAL_BYTE.END)
  }

  writer.u8(NODE_SPECIAL_BYTE.END) // root END
  return writer.finish()
}

function validateWriteInput(data: OtbWriteInput): void {
  const seen = new Set<number>()
  for (const item of data.items) {
    if (item.group === ITEM_GROUP.DEPRECATED) continue
    if (item.sid <= 0) throw new ParseError(`OTB write: item sid must be > 0, got ${item.sid}`)
    if (seen.has(item.sid)) throw new ParseError(`OTB write: duplicate sid ${item.sid}`)
    seen.add(item.sid)
  }
}

function writeAttrs(writer: EscapedBinaryWriter, item: OtbItem): void {
  const a = item.attributes

  writer.u8(ITEM_ATTRIBUTE.SERVERID)
  writer.escU16(2)
  writer.escU16(item.sid)

  if (item.cid !== 0) {
    writer.u8(ITEM_ATTRIBUTE.CLIENT_ID)
    writer.escU16(2)
    writer.escU16(item.cid)
  }

  if (a.name !== undefined) {
    const encoded = encodeStr(a.name)
    writer.u8(ITEM_ATTRIBUTE.NAME)
    writer.escU16(encoded.length)
    writer.escBytes(encoded)
  }

  if (a.description !== undefined) {
    const encoded = encodeStr(a.description)
    writer.u8(ITEM_ATTRIBUTE.DESCRIPTION)
    writer.escU16(encoded.length)
    writer.escBytes(encoded)
  }

  if (a.speed !== undefined) {
    writer.u8(ITEM_ATTRIBUTE.SPEED)
    writer.escU16(2)
    writer.escU16(a.speed)
  }

  if (a.weight !== undefined) {
    writer.u8(ITEM_ATTRIBUTE.WEIGHT)
    writer.escU16(8)
    writer.escU64(a.weight)
  }

  if (a.spriteHash !== undefined) {
    writer.u8(ITEM_ATTRIBUTE.SPRITEHASH)
    writer.escU16(a.spriteHash.length)
    writer.escBytes(a.spriteHash)
  }

  if (a.minimapColor !== undefined) {
    writer.u8(ITEM_ATTRIBUTE.MINIMAPCOLOR)
    writer.escU16(2)
    writer.escU16(a.minimapColor)
  }

  if (a.maxItems !== undefined) {
    writer.u8(ITEM_ATTRIBUTE.MAXITEMS)
    writer.escU16(2)
    writer.escU16(a.maxItems)
  }

  if (a.rotateTo !== undefined) {
    writer.u8(ITEM_ATTRIBUTE.ROTATETO)
    writer.escU16(2)
    writer.escU16(a.rotateTo)
  }

  if (a.maxWriteLength !== undefined) {
    writer.u8(ITEM_ATTRIBUTE.MAX_WRITE_LENGTH)
    writer.escU16(2)
    writer.escU16(a.maxWriteLength)
  }

  if (a.maxReadLength !== undefined) {
    writer.u8(ITEM_ATTRIBUTE.MAX_READ_LENGTH)
    writer.escU16(2)
    writer.escU16(a.maxReadLength)
  }

  if (a.lightLevel !== undefined || a.lightColor !== undefined) {
    writer.u8(ITEM_ATTRIBUTE.LIGHT2)
    writer.escU16(4)
    writer.escU16(a.lightLevel ?? 0)
    writer.escU16(a.lightColor ?? 0)
  }

  if (a.alwaysOnTopOrder !== undefined) {
    writer.u8(ITEM_ATTRIBUTE.TOPORDER)
    writer.escU16(1)
    writer.escU8(a.alwaysOnTopOrder)
  }

  if (a.wareId !== undefined) {
    writer.u8(ITEM_ATTRIBUTE.WAREID)
    writer.escU16(2)
    writer.escU16(a.wareId)
  }

  if (a.classification !== undefined) {
    writer.u8(ITEM_ATTRIBUTE.CLASSIFICATION)
    writer.escU16(1)
    writer.escU8(a.classification)
  }
}
