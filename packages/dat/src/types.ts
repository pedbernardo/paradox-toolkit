export type ThingGroup = 'items' | 'creatures' | 'effects' | 'missiles'

/** Counts from the DAT file header. Note: `itemsMaxCid` is the last item CID, not a count. */
export type DatCounts = {
  /** Last client ID of items in the file. itemCount = itemsMaxCid - ITEMS_START_ID + 1 */
  itemsMaxCid: number
  /** Number of creature entries */
  creatures: number
  /** Number of effect entries */
  effects: number
  /** Number of missile entries */
  missiles: number
}

/** Full market data from the MARKET flag (9.6+). */
export type MarketData = {
  category: number
  tradeAs: number
  showAs: number
  name: string
  restrictVocation: number
  requiredLevel: number
}

/** Per-frame animation timing data (10.30+). Present when frames > 1. */
export type AnimationData = {
  async: boolean
  /** Signed i32: -1 = infinite loop, 0 = no loop, N = loop N times */
  loopCount: number
  /** Signed i8: starting frame phase */
  startPhase: number
  phaseDurations: Array<{ min: number; max: number }>
}

/** A single frame group from a creature with multiple animation phases (10.57+). */
export type FrameGroup = {
  groupType: number
  layout: ThingLayout
  spriteIds: number[]
}

/** Sprite layout dimensions and animation structure of a thing. */
export type ThingLayout = {
  width: number
  height: number
  layers: number
  patternX: number
  patternY: number
  patternZ: number
  frames: number
  /** Raw size byte from file, present when width > 1 or height > 1 */
  realSize: number
  /** Computed: Math.min(realSize, Math.max(width * 32, height * 32)) */
  exactSize: number
  /** Per-frame animation timing (10.30+). Present when frames > 1 and version >= 1030. */
  animation?: AnimationData
}

/** Parsed flag attributes for a thing. All fields are optional — only present flags are set. */
export type ThingFlags = {
  /** Ground tile with movement speed value */
  ground?: { speed: number }
  /** Drawn on top of ground tiles as border decoration */
  groundBorder?: true
  /** Always drawn below other objects */
  onBottom?: true
  /** Always drawn on top of other objects */
  onTop?: true
  container?: true
  stackable?: true
  forceUse?: true
  multiUse?: true
  /** Writable item with max text length */
  writable?: { length: number }
  /** Read-only writable item with max text length */
  writableOnce?: { length: number }
  fluidContainer?: true
  /** Fluid splash item */
  fluid?: true
  /** Blocks creature movement */
  unpassable?: true
  /** Cannot be moved by players */
  unmovable?: true
  /** Blocks missile projectiles */
  blockMissiles?: true
  /** Blocks pathfinder/auto-walk */
  blockPathfinder?: true
  pickupable?: true
  hangable?: true
  /** Hangs on vertical surfaces */
  vertical?: true
  /** Hangs on horizontal surfaces */
  horizontal?: true
  rotatable?: true
  /** Emits light with level and color */
  lightInfo?: { level: number; color: number }
  /** Not hidden by roofs or similar */
  dontHide?: true
  /** Translucent rendering (8.6+, replaces floorChange at value 23) */
  translucent?: true
  /** Drawn with pixel offset */
  hasOffset?: { offsetX: number; offsetY: number }
  /** Adds elevation to the tile */
  hasElevation?: { height: number }
  lyingObject?: true
  alwaysAnimate?: true
  /** Colored dot on minimap */
  minimap?: { color: number }
  /** Lens/look help value */
  lensHelp?: { value: number }
  fullGround?: true
  /** Ignored by look action */
  ignoreUser?: true
  floorChange?: true
  // 8.6+
  /** Cloth slot identifier */
  cloth?: { slot: number }
  /** Full market data for in-game market trading (9.6+) */
  market?: MarketData
  /** Usable item sub-type value */
  usable?: { value: number }
  wrappable?: true
  unwrappable?: true
  topEffect?: true
  // 10.x+
  noMoveAnimation?: true
}

/** A single parsed thing entry from the DAT file. */
export type Thing = {
  /** Client ID */
  cid: number
  group: ThingGroup
  flags: ThingFlags
  layout: ThingLayout
  /** Sprite IDs in layout order */
  spriteIds: number[]
  /** All frame groups for creatures in version 10.57+ (frameGroups feature). layout and spriteIds mirror the last group. */
  frameGroups?: FrameGroup[]
}

/** The result of a successful DAT load. Encapsulates all parsed things. */
export type DatFile = {
  readonly version: number
  readonly signature: number
  readonly counts: DatCounts
  /** All parsed things in CID order (items, creatures, effects, missiles). */
  readonly things: readonly Thing[]
  get(group: ThingGroup, index: number): Thing | undefined
  entries(): Iterable<Thing>
}

/** Input for dat.write(). DatFile satisfies this structurally. */
export type DatWriteInput = {
  version: number
  signature: number
  things: Thing[]
}
