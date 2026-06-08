import { ParseError } from '@paradox/utils'

export const NODE_SPECIAL_BYTE = {
  START: 0xfe,
  END: 0xff,
  ESCAPE: 0xfd
} as const

export const ROOT_NODE_ATTR = 1
export const OTB_VERSIONS = [1, 2, 3] as const

export function parseSchemaVersion(v: string): { major: number; minor: number; build: number } {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(v)

  if (match === null) {
    throw new ParseError(`OTB: invalid schema version "${v}"`)
  }
  const major = Number(match[1])
  const minor = Number(match[2])
  const build = Number(match[3])

  if (!(OTB_VERSIONS as readonly number[]).includes(major)) {
    throw new ParseError(`OTB: unsupported schema version major ${major}`)
  }

  return { major, minor, build }
}

export const ITEM_GROUP = {
  NONE: 0,
  GROUND: 1,
  CONTAINER: 2,
  WEAPON: 3,
  AMMUNITION: 4,
  ARMOR: 5,
  RUNE: 6,
  TELEPORT: 7,
  MAGICFIELD: 8,
  WRITABLE: 9,
  KEY: 10,
  SPLASH: 11,
  FLUID: 12,
  DOOR: 13,
  DEPRECATED: 14,
  LAST: 15
} as const
