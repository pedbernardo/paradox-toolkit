import type { ThingGroup } from './types.js'

export const DAT_SIGNATURES: Readonly<Record<number, number>> = {
  710: 0x3dff4b2a,
  740: 0x41bf619c,
  750: 0x42f81973,
  755: 0x437b2b8f,
  760: 0x439d5a33,
  770: 0x439d5a33,
  772: 0x439d5a33,
  860: 0x4c28b721,
  870: 0x4cfe22c5,
  960: 0x4ffa74cc,
  980: 0x50c70674,
  1098: 0x000042a3
}

export const DAT_FLAG_END_MARK = 0xff

export type ThingsGroup = { startId: number; group: ThingGroup }

export const THINGS_GROUPS: Readonly<Record<ThingGroup, ThingsGroup>> = {
  items: { startId: 100, group: 'items' },
  creatures: { startId: 1, group: 'creatures' },
  effects: { startId: 1, group: 'effects' },
  missiles: { startId: 1, group: 'missiles' }
}
