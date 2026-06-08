import type { Thing, ThingFlags } from '@paradox/dat'
import type { OtbItem } from '@paradox/otb'
import type { ItemContentDef, StackOrder, VisualOnlyDef } from './types.js'

function deriveStackOrder(flags: ThingFlags): StackOrder {
  if (flags.ground) return 'ground'
  if (flags.groundBorder) return 'border'
  if (flags.onBottom) return 'bottom'
  if (flags.onTop) return 'top'
  return 'regular'
}

export function toItem(
  thing: Thing,
  otb: OtbItem | undefined,
  nameMap: Record<string, string>
): ItemContentDef {
  const dat = thing.flags
  const name = otb?.attributes.name || nameMap[String(thing.cid)] || ''

  return {
    id: thing.cid,
    name,
    gameplay: {
      walkable: !(otb?.flags.unpassable ?? dat.unpassable === true),
      blocksSight: otb?.flags.blockMissiles ?? dat.blockMissiles === true,
      blocksMissile: otb?.flags.blockMissiles ?? dat.blockMissiles === true,
      blockPathfinder: otb?.flags.blockPathfinder ?? dat.blockPathfinder === true,
      groundSpeed: otb?.attributes.speed ?? 0,
      fullGround: otb?.flags.fullGround ?? dat.fullGround === true,
      container: dat.container === true,
      stackable: otb?.flags.stackable ?? dat.stackable === true,
      moveable: otb?.flags.moveable ?? !(dat.unmovable === true),
      pickupable: otb?.flags.pickupable ?? dat.pickupable === true,
      useable: otb?.flags.useable ?? dat.usable !== undefined,
      forceUse: otb?.flags.forceUse ?? dat.forceUse === true,
      multiUse: dat.multiUse === true,
      readable: otb?.flags.readable ?? false,
      allowDistRead: otb?.flags.allowDistRead ?? false,
      writable: dat.writable ? { length: dat.writable.length } : null,
      writableOnce: dat.writableOnce ? { length: dat.writableOnce.length } : null,
      fluidContainer: dat.fluidContainer === true,
      fluid: dat.fluid === true,
      cannotDecay: otb?.flags.cannotDecay ?? false,
      floorChange: dat.floorChange === true,
      floorChangeDown: otb?.flags.floorChangeDown ?? false,
      floorChangeNorth: otb?.flags.floorChangeNorth ?? false,
      floorChangeEast: otb?.flags.floorChangeEast ?? false,
      floorChangeSouth: otb?.flags.floorChangeSouth ?? false,
      floorChangeWest: otb?.flags.floorChangeWest ?? false,
      hangable: otb?.flags.hangable ?? dat.hangable === true,
      hookEast: otb?.flags.hookEast ?? false,
      hookSouth: otb?.flags.hookSouth ?? false,
      vertical: dat.vertical === true,
      horizontal: dat.horizontal === true,
      rotatable: otb?.flags.rotable ?? dat.rotatable === true,
      rotateTo: otb?.attributes.rotateTo ?? null,
      alwaysOnTop: otb?.flags.alwaysOnTop ?? false,
      alwaysOnTopOrder: otb?.attributes.alwaysOnTopOrder ?? 0,
      isAnimation: otb?.flags.isAnimation ?? false,
      clientCharges: otb?.flags.clientCharges ?? false,
      clientDuration: otb?.flags.clientDuration ?? false,
      ignoreLook: otb?.flags.ignoreLook ?? dat.ignoreUser === true,
      weight: otb?.attributes.weight ?? 0,
      maxItems: otb?.attributes.maxItems ?? 0,
      maxWriteLength: otb?.attributes.maxWriteLength ?? 0,
      description: otb?.attributes.description ?? '',
      minimapColor: otb?.attributes.minimapColor ?? dat.minimap?.color ?? null,
      lensHelp: dat.lensHelp?.value ?? null
    },
    visual: {
      spriteIds: thing.spriteIds,
      layout: thing.layout,
      light: dat.lightInfo ? { level: dat.lightInfo.level, color: dat.lightInfo.color } : null,
      elevation: dat.hasElevation?.height ?? 0,
      stackOrder: deriveStackOrder(dat),
      offset: dat.hasOffset ? { x: dat.hasOffset.offsetX, y: dat.hasOffset.offsetY } : null,
      lyingObject: dat.lyingObject === true,
      alwaysAnimate: dat.alwaysAnimate === true,
      dontHide: dat.dontHide === true,
      translucent: dat.translucent === true,
      noMoveAnimation: dat.noMoveAnimation === true
    }
  }
}

export function toVisualOnly(thing: Thing): VisualOnlyDef {
  const dat = thing.flags
  return {
    id: thing.cid,
    visual: {
      spriteIds: thing.spriteIds,
      layout: thing.layout,
      light: dat.lightInfo ? { level: dat.lightInfo.level, color: dat.lightInfo.color } : null
    }
  }
}
