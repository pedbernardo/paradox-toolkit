import { ParseError } from '@paradoxlab/utils'
import type { OtbmLimits } from './types.js'

export const NODE_SPECIAL_BYTE = {
  START: 0xfe,
  END: 0xff,
  ESCAPE: 0xfd
} as const

export const OTBM_NODE_TYPE = {
  WORLD_NODE: 0x00,
  MAP_DATA: 0x02,
  TILE_AREA: 0x04,
  TILE: 0x05,
  ITEM: 0x06,
  TOWNS: 0x0c,
  TOWN: 0x0d,
  HOUSETILE: 0x0e,
  WAYPOINTS: 0x0f,
  WAYPOINT: 0x10
} as const

export const OTBM_ATTRIBUTE = {
  DESCRIPTION: 0x01,
  TILE_FLAGS: 0x03,
  ACTION_ID: 0x04,
  UNIQUE_ID: 0x05,
  TEXT: 0x06,
  DESC: 0x07,
  TELE_DEST: 0x08,
  ITEM: 0x09,
  DEPOT_ID: 0x0a,
  SPAWN_FILE: 0x0b,
  RUNE_CHARGES: 0x0c,
  HOUSE_FILE: 0x0d,
  HOUSE_DOOR: 0x0e,
  COUNT: 0x0f,
  DURATION: 0x10,
  DECAY_STATE: 0x11,
  WRITTEN_DATE: 0x12,
  WRITTEN_BY: 0x13,
  SLEEPER_GUID: 0x14,
  SLEEP_START: 0x15,
  CHARGES: 0x16,
  ATTRIBUTE_MAP: 0x80
} as const

export const OTBM_TILE_FLAG = {
  PROTECTION_ZONE: 0x01,
  NO_PVP: 0x04,
  NO_LOGOUT: 0x08,
  PVP_ZONE: 0x10,
  REFRESH: 0x20
} as const

const MIB = 1 << 20

/**
 * The largest real map known (104 MB, 9.5 million tiles), rounded up. Ceilings are multiples of it,
 * so maps two or three times larger still open; raise it when a larger real map shows up.
 */
export const OTBM_LARGEST_KNOWN = 110 * MIB

/** Multiple of `OTBM_LARGEST_KNOWN` above which a file is refused. */
export const OTBM_HEADROOM = 3

export const DEFAULT_OTBM_LIMITS: OtbmLimits = {
  fileWarnBytes: 2 * OTBM_LARGEST_KNOWN,
  fileBytes: OTBM_HEADROOM * OTBM_LARGEST_KNOWN,
  itemsPerTile: 1024,
  containerChildren: 1024,
  itemNesting: 32,
  nodePropertyBytes: MIB
}

export function resolveLimits(limits: Partial<OtbmLimits> | undefined): OtbmLimits {
  return { ...DEFAULT_OTBM_LIMITS, ...limits }
}

/** Throws above the fatal file size; true when the file is above the warning size. */
export function checkFileSize(byteLength: number, limits: OtbmLimits): boolean {
  if (byteLength > limits.fileBytes) {
    throw new ParseError(
      `OTBM of ${byteLength} bytes is above the ${limits.fileBytes}-byte ceiling`
    )
  }
  return byteLength > limits.fileWarnBytes
}
