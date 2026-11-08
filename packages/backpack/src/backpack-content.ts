import type { Thing, ThingFlags } from '@paradoxlab/dat'
import type { OtbFile, OtbItem } from '@paradoxlab/otb'
import nameMapData from './resources/name-map.json' with { type: 'json' }
import type {
  AppearanceColumns,
  ContentInput,
  ContentJson,
  ItemColumns,
  OtbLineage
} from './types.js'
import { AppearanceFlag, FloorChange, ItemFlag, StackOrder } from './backpack-flags.js'

export const CONTENT_SCHEMA = '2.0.0'

const NAMES_BY_CID = nameMapData as Record<string, string>

const bit = (on: boolean, value: number): number => (on ? value : 0)

function emptyAppearances(): AppearanceColumns {
  return {
    cid: [],
    width: [],
    height: [],
    layers: [],
    patternX: [],
    patternY: [],
    patternZ: [],
    frames: [],
    spriteStart: [],
    spriteIds: [],
    order: [],
    elevation: [],
    offsetX: [],
    offsetY: [],
    lightLevel: [],
    lightColor: [],
    flags: []
  }
}

function stackOrderOf(flags: ThingFlags): number {
  if (flags.ground) return StackOrder.Ground
  if (flags.groundBorder) return StackOrder.Border
  if (flags.onBottom) return StackOrder.Bottom
  if (flags.onTop) return StackOrder.Top
  return StackOrder.Common
}

function addAppearance(columns: AppearanceColumns, thing: Thing): void {
  const { flags, layout } = thing
  columns.cid.push(thing.cid)
  columns.width.push(layout.width)
  columns.height.push(layout.height)
  columns.layers.push(layout.layers)
  columns.patternX.push(layout.patternX)
  columns.patternY.push(layout.patternY)
  columns.patternZ.push(layout.patternZ)
  columns.frames.push(layout.frames)
  columns.spriteStart.push(columns.spriteIds.length)
  for (const id of thing.spriteIds) columns.spriteIds.push(id)
  columns.order.push(stackOrderOf(flags))
  columns.elevation.push(flags.hasElevation?.height ?? 0)
  columns.offsetX.push(flags.hasOffset?.offsetX ?? 0)
  columns.offsetY.push(flags.hasOffset?.offsetY ?? 0)
  columns.lightLevel.push(flags.lightInfo?.level ?? 0)
  columns.lightColor.push(flags.lightInfo?.color ?? 0)
  columns.flags.push(
    bit(flags.lyingObject === true, AppearanceFlag.LyingObject) |
      bit(flags.alwaysAnimate === true, AppearanceFlag.AlwaysAnimate) |
      bit(flags.dontHide === true, AppearanceFlag.DontHide) |
      bit(flags.translucent === true, AppearanceFlag.Translucent) |
      bit(flags.noMoveAnimation === true, AppearanceFlag.NoMoveAnimation)
  )
}

function emptyItems(): ItemColumns {
  return {
    sid: [],
    cid: [],
    name: [],
    flags: [],
    floorChange: [],
    groundSpeed: [],
    weight: [],
    maxItems: [],
    maxWriteLength: [],
    writableLength: [],
    writableOnceLength: [],
    rotateTo: [],
    alwaysOnTopOrder: [],
    minimapColor: [],
    lensHelp: [],
    description: [],
    appearance: []
  }
}

/** Gameplay comes from the OTB when the item has an entry, with the DAT flags as fallback. */
function addItem(
  columns: ItemColumns,
  sid: number,
  cid: number,
  otb: OtbItem | undefined,
  thing: Thing | undefined,
  appearance: number
): void {
  const dat: ThingFlags = thing?.flags ?? {}
  const o = otb?.flags
  const a = otb?.attributes
  columns.sid.push(sid)
  columns.cid.push(cid)
  columns.name.push(a?.name || NAMES_BY_CID[String(cid)] || '')
  columns.flags.push(
    bit(!(o?.unpassable ?? dat.unpassable === true), ItemFlag.Walkable) |
      bit(o?.blockMissiles ?? dat.blockMissiles === true, ItemFlag.BlocksMissile) |
      bit(o?.blockPathfinder ?? dat.blockPathfinder === true, ItemFlag.BlocksPathfinder) |
      bit(o?.fullGround ?? dat.fullGround === true, ItemFlag.FullGround) |
      bit(dat.container === true, ItemFlag.Container) |
      bit(o?.stackable ?? dat.stackable === true, ItemFlag.Stackable) |
      bit(o?.moveable ?? dat.unmovable !== true, ItemFlag.Moveable) |
      bit(o?.pickupable ?? dat.pickupable === true, ItemFlag.Pickupable) |
      bit(o?.useable ?? dat.usable !== undefined, ItemFlag.Useable) |
      bit(o?.forceUse ?? dat.forceUse === true, ItemFlag.ForceUse) |
      bit(dat.multiUse === true, ItemFlag.MultiUse) |
      bit(o?.readable ?? false, ItemFlag.Readable) |
      bit(o?.allowDistRead ?? false, ItemFlag.AllowDistRead) |
      bit(dat.fluidContainer === true, ItemFlag.FluidContainer) |
      bit(dat.fluid === true, ItemFlag.Fluid) |
      bit(o?.cannotDecay ?? false, ItemFlag.CannotDecay) |
      bit(o?.hangable ?? dat.hangable === true, ItemFlag.Hangable) |
      bit(o?.hookEast ?? false, ItemFlag.HookEast) |
      bit(o?.hookSouth ?? false, ItemFlag.HookSouth) |
      bit(dat.vertical === true, ItemFlag.Vertical) |
      bit(dat.horizontal === true, ItemFlag.Horizontal) |
      bit(o?.rotable ?? dat.rotatable === true, ItemFlag.Rotatable) |
      bit(o?.alwaysOnTop ?? false, ItemFlag.AlwaysOnTop) |
      bit(o?.isAnimation ?? false, ItemFlag.IsAnimation) |
      bit(o?.clientCharges ?? false, ItemFlag.ClientCharges) |
      bit(o?.clientDuration ?? false, ItemFlag.ClientDuration) |
      bit(o?.ignoreLook ?? dat.ignoreUser === true, ItemFlag.IgnoreLook)
  )
  columns.floorChange.push(
    bit(dat.floorChange === true, FloorChange.Any) |
      bit(o?.floorChangeDown ?? false, FloorChange.Down) |
      bit(o?.floorChangeNorth ?? false, FloorChange.North) |
      bit(o?.floorChangeEast ?? false, FloorChange.East) |
      bit(o?.floorChangeSouth ?? false, FloorChange.South) |
      bit(o?.floorChangeWest ?? false, FloorChange.West)
  )
  columns.groundSpeed.push(a?.speed ?? dat.ground?.speed ?? 0)
  columns.weight.push(a?.weight ?? 0)
  columns.maxItems.push(a?.maxItems ?? 0)
  columns.maxWriteLength.push(a?.maxWriteLength ?? 0)
  columns.writableLength.push(dat.writable?.length ?? -1)
  columns.writableOnceLength.push(dat.writableOnce?.length ?? -1)
  columns.rotateTo.push(a?.rotateTo ?? -1)
  columns.alwaysOnTopOrder.push(a?.alwaysOnTopOrder ?? 0)
  columns.minimapColor.push(a?.minimapColor ?? dat.minimap?.color ?? -1)
  columns.lensHelp.push(dat.lensHelp?.value ?? -1)
  columns.description.push(a?.description ?? '')
  columns.appearance.push(appearance)
}

const lineageOf = (otb: OtbFile): OtbLineage => {
  const [major = 0, minor = 0] = otb.schemaVersion.split('.').map(Number)
  return { otbMajor: major, otbMinor: minor }
}

/**
 * Item content by sid from a DAT and, when there is one, an OTB: one item per OTB entry (sids
 * sharing a cid share its appearance), and one appearance per client thing. A thing without an
 * OTB entry is only an appearance; no sid is ever made up.
 */
export function buildContent({ dat, otb }: ContentInput): ContentJson {
  const appearances = emptyAppearances()
  const creatures = emptyAppearances()
  const effects = emptyAppearances()
  const missiles = emptyAppearances()
  const groups = { items: appearances, creatures, effects, missiles }
  const itemThings = new Map<number, { thing: Thing; row: number }>()
  for (const thing of dat.entries()) {
    const columns = groups[thing.group]
    if (thing.group === 'items') itemThings.set(thing.cid, { thing, row: columns.cid.length })
    addAppearance(columns, thing)
  }

  const items = emptyItems()
  if (otb === undefined) {
    for (const [cid, { thing, row }] of itemThings) addItem(items, cid, cid, undefined, thing, row)
  } else {
    for (const item of otb.items) {
      const client = itemThings.get(item.cid)
      addItem(items, item.sid, item.cid, item, client?.thing, client?.row ?? -1)
    }
  }

  return {
    meta: {
      schema: CONTENT_SCHEMA,
      client: dat.version,
      dat: dat.signature.toString(16).toUpperCase().padStart(8, '0'),
      lineage: otb === undefined ? null : lineageOf(otb)
    },
    items,
    appearances,
    creatures,
    effects,
    missiles
  }
}
