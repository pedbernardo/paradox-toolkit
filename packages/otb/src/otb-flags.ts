import { snakeCaseToCamelCase } from '@paradoxlab/utils'
import type { OtbItemFlags } from './types.js'

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
