import type { MapScan } from './manifest.js'

const NODE_START = 0xfe
const NODE_END = 0xff
const ESCAPE = 0xfd

const TILE_AREA = 4
const TILE = 5
const ITEM = 6
const TOWN = 13
const HOUSE_TILE = 14
const WAYPOINT = 16

/**
 * Measures the structure of an OTBM from its bytes alone: node nesting, escapes and node types. It
 * deliberately shares no code with any OTBM reader, so readers can be checked against it.
 */
export function scanOtbm(bytes: Uint8Array): MapScan {
  const types: number[] = []
  const childCounts: number[] = []
  let tiles = 0
  let strayTiles = 0
  let houseTiles = 0
  let itemNodes = 0
  let areas = 0
  let towns = 0
  let waypoints = 0
  let maxDepth = 0
  let maxItemNesting = 0
  let maxItemNodesPerTile = 0
  let maxContainerChildren = 0
  let maxTilesPerArea = 0
  let maxNodeProps = 0

  let itemDepth = 0
  let tileItems = 0
  let tilesInArea = 0
  let props = 0

  const closeProps = (): void => {
    if (props > maxNodeProps) maxNodeProps = props
    props = 0
  }

  let i = 4
  while (i < bytes.length) {
    const byte = bytes[i]
    if (byte === NODE_START) {
      closeProps()
      const type = bytes[i + 1] ?? -1
      const parent = types.at(-1)
      types.push(type)
      if (types.length > maxDepth) maxDepth = types.length
      if (type === ITEM) {
        itemNodes++
        if (itemDepth === 0) tileItems++
        else childCounts[itemDepth - 1] = (childCounts[itemDepth - 1] ?? 0) + 1
        itemDepth++
        childCounts[itemDepth - 1] = 0
        if (itemDepth > maxItemNesting) maxItemNesting = itemDepth
      } else if (type === TILE || type === HOUSE_TILE) {
        if (parent === TILE_AREA) {
          tiles++
          tilesInArea++
          if (type === HOUSE_TILE) houseTiles++
        } else {
          strayTiles++
        }
        tileItems = 0
      } else if (type === TILE_AREA) {
        areas++
        tilesInArea = 0
      } else if (type === TOWN) {
        towns++
      } else if (type === WAYPOINT) {
        waypoints++
      }
      i += 2
      continue
    }
    if (byte === NODE_END) {
      closeProps()
      const type = types.pop()
      if (type === ITEM) {
        itemDepth--
        const children = childCounts[itemDepth] ?? 0
        if (children > maxContainerChildren) maxContainerChildren = children
      } else if (type === TILE || type === HOUSE_TILE) {
        if (tileItems > maxItemNodesPerTile) maxItemNodesPerTile = tileItems
      } else if (type === TILE_AREA) {
        if (tilesInArea > maxTilesPerArea) maxTilesPerArea = tilesInArea
      }
      i++
      if (types.length === 0) break
      continue
    }
    if (byte === ESCAPE) i++
    props++
    i++
  }

  return {
    tiles,
    strayTiles,
    houseTiles,
    itemNodes,
    areas,
    towns,
    waypoints,
    maxDepth,
    maxItemNesting,
    maxItemNodesPerTile,
    maxContainerChildren,
    maxTilesPerArea,
    maxNodeProps
  }
}
