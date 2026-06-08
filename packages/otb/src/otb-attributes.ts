import type { EscapedBinaryReader } from '@paradox/utils'
import type { OtbItem } from './types.js'

const textDecoderLatin1 = new TextDecoder('latin1')

export const ITEM_ATTRIBUTE = {
  SERVERID: 16,
  CLIENT_ID: 17,
  NAME: 18,
  DESCRIPTION: 19,
  SPEED: 20,
  SLOT: 21,
  MAXITEMS: 22,
  WEIGHT: 23,
  WEAPON: 24,
  AMMUNITION: 25,
  ARMOR: 26,
  MAGICLEVEL: 27,
  MAGICFIELDTYPE: 28,
  WRITEABLE: 29,
  ROTATETO: 30,
  DECAY: 31,
  SPRITEHASH: 32,
  MINIMAPCOLOR: 33,
  MAX_WRITE_LENGTH: 34,
  MAX_READ_LENGTH: 35,
  LIGHT: 36,
  DECAY2: 37,
  WEAPON2: 38,
  AMMUNITION2: 39,
  ARMOR2: 40,
  WRITEABLE2: 41,
  LIGHT2: 42,
  TOPORDER: 43,
  WAREID: 45,
  CLASSIFICATION: 46
} as const

type HandlerProps = { item: OtbItem; reader: EscapedBinaryReader; length: number }

export const ATTRIBUTE_HANDLERS: Record<number, (props: HandlerProps) => void> = {
  [ITEM_ATTRIBUTE.SERVERID]: ({ item, reader }) => {
    item.sid = reader.escU16()
  },

  [ITEM_ATTRIBUTE.CLIENT_ID]: ({ item, reader }) => {
    item.cid = reader.escU16()
  },

  [ITEM_ATTRIBUTE.NAME]: ({ item, reader, length }) => {
    item.attributes.name = readEscStr(reader, length)
  },

  [ITEM_ATTRIBUTE.DESCRIPTION]: ({ item, reader, length }) => {
    item.attributes.description = readEscStr(reader, length)
  },

  [ITEM_ATTRIBUTE.SPEED]: ({ item, reader }) => {
    item.attributes.speed = reader.escU16()
  },

  [ITEM_ATTRIBUTE.SPRITEHASH]: ({ item, reader, length }) => {
    item.attributes.spriteHash = reader.escBytes(length)
  },

  [ITEM_ATTRIBUTE.MINIMAPCOLOR]: ({ item, reader }) => {
    item.attributes.minimapColor = reader.escU16()
  },

  [ITEM_ATTRIBUTE.MAXITEMS]: ({ item, reader }) => {
    item.attributes.maxItems = reader.escU16()
  },

  [ITEM_ATTRIBUTE.WEIGHT]: ({ item, reader }) => {
    item.attributes.weight = reader.escU64()
  },

  [ITEM_ATTRIBUTE.TOPORDER]: ({ item, reader }) => {
    item.attributes.alwaysOnTopOrder = reader.escU8()
  },

  [ITEM_ATTRIBUTE.ROTATETO]: ({ item, reader }) => {
    item.attributes.rotateTo = reader.escU16()
  },

  [ITEM_ATTRIBUTE.MAX_WRITE_LENGTH]: ({ item, reader }) => {
    item.attributes.maxWriteLength = reader.escU16()
  },

  [ITEM_ATTRIBUTE.MAX_READ_LENGTH]: ({ item, reader }) => {
    item.attributes.maxReadLength = reader.escU16()
  },

  [ITEM_ATTRIBUTE.LIGHT]: ({ item, reader }) => {
    item.attributes.lightLevel = reader.escU16()
    item.attributes.lightColor = reader.escU16()
  },

  [ITEM_ATTRIBUTE.LIGHT2]: ({ item, reader }) => {
    item.attributes.lightLevel = reader.escU16()
    item.attributes.lightColor = reader.escU16()
  },

  [ITEM_ATTRIBUTE.WAREID]: ({ item, reader }) => {
    item.attributes.wareId = reader.escU16()
  },

  [ITEM_ATTRIBUTE.CLASSIFICATION]: ({ item, reader }) => {
    item.attributes.classification = reader.escU8()
  }
}

function readEscStr(reader: EscapedBinaryReader, length: number): string {
  return textDecoderLatin1.decode(reader.escBytes(length))
}

export function encodeStr(s: string): Uint8Array {
  const result = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) {
    result[i] = s.charCodeAt(i) & 0xff
  }
  return result
}
