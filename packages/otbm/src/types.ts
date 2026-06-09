export type OtbLookup = {
  getBySid(sid: number): { cid: number } | undefined
}

export type OtbmOptions = {
  lookup?: OtbLookup
}

export type OtbmTileFlags = {
  protectionZone: boolean
  noPvp: boolean
  noLogout: boolean
  pvpZone: boolean
  refresh: boolean
}

export type OtbmItem = {
  sid: number
  cid?: number
  count?: number
  actionId?: number
  uniqueId?: number
  charges?: number
  text?: string
  writtenBy?: string
  writtenDate?: number
  destX?: number
  destY?: number
  destZ?: number
  depotId?: number
  duration?: number
  decayState?: number
  houseDoor?: number
  children?: OtbmItem[]
}

export type OtbmRegularTile = {
  kind: 'tile'
  x: number
  y: number
  z: number
  // Raw bitmask — kept as number (not OtbmTileFlags) to avoid allocating one object per tile;
  // maps can have 100k+ tiles. Use decodeTileFlags() from @paradoxlab/otbm when you need the
  // decoded form.
  flags: number
  actionId?: number
  items: OtbmItem[]
}

export type OtbmHouseTile = {
  kind: 'house'
  x: number
  y: number
  z: number
  houseId: number
  // Raw bitmask — see OtbmRegularTile.flags for rationale.
  flags: number
  actionId?: number
  items: OtbmItem[]
}

export type OtbmTile = OtbmRegularTile | OtbmHouseTile

export type OtbmTileArea = {
  baseX: number
  baseY: number
  baseZ: number
  tiles: OtbmTile[]
}

export type OtbmTown = {
  id: number
  name: string
  x: number
  y: number
  z: number
}

export type OtbmWaypoint = {
  name: string
  x: number
  y: number
  z: number
}

export type OtbmHeader = {
  version: number
  width: number
  height: number
  majorVersion: number
  minorVersion: number
}

export type OtbmStats = {
  areas: number
  tiles: number
  houseTiles: number
  items: number
  nestedItems: number
  towns: number
  waypoints: number
}

export type OtbmWriteInput = {
  header: OtbmHeader
  areas: OtbmTileArea[]
  towns: OtbmTown[]
  waypoints: OtbmWaypoint[]
}

export type OtbmWriteOpts = {
  onProgress?: (pct: number) => void
}

export type OtbmFile = {
  readonly header: OtbmHeader
  readonly areas: OtbmTileArea[]
  readonly towns: OtbmTown[]
  readonly waypoints: OtbmWaypoint[]
  getTile(x: number, y: number, z: number): OtbmTile | undefined
  getStats(): OtbmStats
}
