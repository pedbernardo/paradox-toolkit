import type { OutputBuffer } from '@paradoxlab/utils'
import { OTBM_ATTRIBUTE } from './otbm-config.js'
import type { OtbmItemAttribute } from './types.js'

/** What an attribute reads its value with; the stream parser implements it over node properties. */
export type AttributeReader = {
  u8(): number
  u16(): number
  u32(): number
  str(): string
}

type Kind = Exclude<OtbmItemAttribute['kind'], 'unknown'>
type AttributeOf<K extends Kind> = Extract<OtbmItemAttribute, { kind: K }>

/** One item attribute, read and written in the same place so both directions stay symmetric. */
type AttributeSpec<K extends Kind = Kind> = {
  readonly id: number
  readonly kind: K
  read(reader: AttributeReader): AttributeOf<K>
  write(output: OutputBuffer, attribute: AttributeOf<K>): void
}

type ValueKind = {
  [K in Kind]: AttributeOf<K> extends { value: infer V } ? (V extends number ? K : never) : never
}[Kind]
type TextKind = { [K in Kind]: AttributeOf<K> extends { value: string } ? K : never }[Kind]

const u8 = <K extends ValueKind>(id: number, kind: K): AttributeSpec<K> => ({
  id,
  kind,
  read: (r) => ({ kind, value: r.u8() }) as AttributeOf<K>,
  write: (w, a) => w.escU8((a as { value: number }).value)
})
const u16 = <K extends ValueKind>(id: number, kind: K): AttributeSpec<K> => ({
  id,
  kind,
  read: (r) => ({ kind, value: r.u16() }) as AttributeOf<K>,
  write: (w, a) => w.escU16((a as { value: number }).value)
})
const u32 = <K extends ValueKind>(id: number, kind: K): AttributeSpec<K> => ({
  id,
  kind,
  read: (r) => ({ kind, value: r.u32() }) as AttributeOf<K>,
  write: (w, a) => w.escU32((a as { value: number }).value)
})
const text = <K extends TextKind>(id: number, kind: K): AttributeSpec<K> => ({
  id,
  kind,
  read: (r) => ({ kind, value: r.str() }) as AttributeOf<K>,
  write: (w, a) => w.escStr((a as { value: string }).value)
})

export const ITEM_ATTRIBUTES: readonly AttributeSpec[] = [
  u8(OTBM_ATTRIBUTE.COUNT, 'count'),
  u16(OTBM_ATTRIBUTE.ACTION_ID, 'actionId'),
  u16(OTBM_ATTRIBUTE.UNIQUE_ID, 'uniqueId'),
  text(OTBM_ATTRIBUTE.TEXT, 'text'),
  text(OTBM_ATTRIBUTE.DESC, 'description'),
  {
    id: OTBM_ATTRIBUTE.TELE_DEST,
    kind: 'teleport',
    read: (r) => ({ kind: 'teleport', x: r.u16(), y: r.u16(), z: r.u8() }),
    write: (w, a) => {
      w.escU16(a.x)
      w.escU16(a.y)
      w.escU8(a.z)
    }
  } satisfies AttributeSpec<'teleport'>,
  u16(OTBM_ATTRIBUTE.DEPOT_ID, 'depotId'),
  u8(OTBM_ATTRIBUTE.RUNE_CHARGES, 'runeCharges'),
  u8(OTBM_ATTRIBUTE.HOUSE_DOOR, 'houseDoorId'),
  u32(OTBM_ATTRIBUTE.DURATION, 'duration'),
  u8(OTBM_ATTRIBUTE.DECAY_STATE, 'decayState'),
  u32(OTBM_ATTRIBUTE.WRITTEN_DATE, 'writtenDate'),
  text(OTBM_ATTRIBUTE.WRITTEN_BY, 'writtenBy'),
  u32(OTBM_ATTRIBUTE.SLEEPER_GUID, 'sleeperGuid'),
  u32(OTBM_ATTRIBUTE.SLEEP_START, 'sleepStart'),
  u16(OTBM_ATTRIBUTE.CHARGES, 'charges')
] as readonly AttributeSpec[]

/** Item attributes by id, for the reader; `undefined` is an id the toolkit does not know. */
export const ITEM_ATTRIBUTE_BY_ID: readonly (AttributeSpec | undefined)[] = (() => {
  const byId: (AttributeSpec | undefined)[] = new Array(256).fill(undefined)
  for (const spec of ITEM_ATTRIBUTES) byId[spec.id] = spec
  return byId
})()

/** Item attributes by kind, for the encoder. */
export const ITEM_ATTRIBUTE_BY_KIND: Readonly<Record<Kind, AttributeSpec>> = Object.fromEntries(
  ITEM_ATTRIBUTES.map((spec) => [spec.kind, spec])
) as Record<Kind, AttributeSpec>
