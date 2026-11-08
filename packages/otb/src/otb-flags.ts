import { snakeCaseToCamelCase } from '@paradoxlab/utils'
import { ITEM_GROUP } from './otb-config.js'
import type { OtbFile, OtbItemFlags } from './types.js'

export const ITEM_FLAG = {
  UNPASSABLE: 1 << 0,
  BLOCK_MISSILES: 1 << 1,
  BLOCK_PATHFINDER: 1 << 2,
  HAS_ELEVATION: 1 << 3,
  USEABLE: 1 << 4,
  PICKUPABLE: 1 << 5,
  MOVEABLE: 1 << 6,
  STACKABLE: 1 << 7,
  FLOOR_CHANGE_DOWN: 1 << 8,
  FLOOR_CHANGE_NORTH: 1 << 9,
  FLOOR_CHANGE_EAST: 1 << 10,
  FLOOR_CHANGE_SOUTH: 1 << 11,
  FLOOR_CHANGE_WEST: 1 << 12,
  ALWAYS_ON_TOP: 1 << 13,
  READABLE: 1 << 14,
  ROTABLE: 1 << 15,
  HANGABLE: 1 << 16,
  HOOK_EAST: 1 << 17,
  HOOK_SOUTH: 1 << 18,
  CANNOT_DECAY: 1 << 19,
  ALLOW_DIST_READ: 1 << 20,
  CLIENT_DURATION: 1 << 21,
  CLIENT_CHARGES: 1 << 22,
  IGNORE_LOOK: 1 << 23,
  IS_ANIMATION: 1 << 24,
  FULL_GROUND: 1 << 25,
  FORCE_USE: 1 << 26
} as const

export function getItemFlags(flagsInt: number): OtbItemFlags {
  const flags = {} as Record<string, boolean>
  for (const [name, value] of Object.entries(ITEM_FLAG)) {
    flags[snakeCaseToCamelCase(name)] = (flagsInt & value) === value
  }
  return flags as OtbItemFlags
}

export function flagsToInt(flags: OtbItemFlags): number {
  let result = 0
  for (const [name, value] of Object.entries(ITEM_FLAG)) {
    if (flags[snakeCaseToCamelCase(name) as keyof OtbItemFlags]) {
      result |= value
    }
  }
  return result
}

/**
 * Builds the predicate that reading an OTBM v1 needs: in v1, stackable, splash and fluid-container
 * items store their count as an untagged byte right after the sid, and only the item database can
 * tell which sids do. Backed by one bit per sid.
 */
export function inlineCountOf(otb: OtbFile): (sid: number) => boolean {
  let maxSid = 0
  for (const item of otb.items) if (item.sid > maxSid) maxSid = item.sid
  const bits = new Uint8Array((maxSid >> 3) + 1)

  for (const item of otb.items) {
    const isSplash = item.group === ITEM_GROUP.SPLASH
    const isFluidContainer = item.group === ITEM_GROUP.FLUID
    const storesCount = item.flags.stackable || isSplash || isFluidContainer
    if (storesCount) bits[item.sid >> 3]! |= 1 << (item.sid & 7)
  }

  return (sid) => {
    const isInDatabase = sid >= 0 && sid <= maxSid
    return isInDatabase && (bits[sid >> 3]! & (1 << (sid & 7))) !== 0
  }
}
