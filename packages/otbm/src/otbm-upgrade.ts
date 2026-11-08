import type { OtbmSource, OtbmUpgradeTarget, OtbmVisitor } from './types.js'

/**
 * Upgrades a map to a newer OTBM version as it streams. From v1, inline counts become tagged count
 * attributes; every other event passes through. Downgrades lose data (waypoints, attributes), so
 * they are refused.
 */
export function upgradeOtbm(source: OtbmSource, target: OtbmUpgradeTarget): OtbmSource {
  const targetHeaderVersion = target - 1

  return {
    emit(visitor) {
      const upgraded: OtbmVisitor = {
        header(header) {
          if (header.version > targetHeaderVersion) {
            throw new RangeError(`Cannot convert OTBM v${header.version + 1} down to v${target}`)
          }
          visitor.header?.({ ...header, version: targetHeaderVersion })
        },
        item(sid, form, attributes) {
          visitor.item?.(sid, form === 'node+inlineCount' ? 'node' : form, attributes)
        },
        mapData: (data) => visitor.mapData?.(data),
        mapDataEnd: () => visitor.mapDataEnd?.(),
        area: (x, y, z, tail) => visitor.area?.(x, y, z, tail),
        areaEnd: () => visitor.areaEnd?.(),
        tile: (x, y, z, flags, houseId, tail) => visitor.tile?.(x, y, z, flags, houseId, tail),
        tileEnd: () => visitor.tileEnd?.(),
        itemEnd: () => visitor.itemEnd?.(),
        list: (kind) => visitor.list?.(kind),
        listEnd: () => visitor.listEnd?.(),
        town: (town) => visitor.town?.(town),
        waypoint: (waypoint) => visitor.waypoint?.(waypoint),
        unknownNode: (type, raw) => visitor.unknownNode?.(type, raw),
        diagnostic: (diagnostic) => visitor.diagnostic?.(diagnostic),
        end: (trailing) => visitor.end?.(trailing)
      }
      return source.emit(upgraded)
    }
  }
}
