import type { DatFile } from '@paradoxlab/dat'
import type { OtbFile } from '@paradoxlab/otb'
import type { SprFile } from '@paradoxlab/spr'

/** OTB lineage of the items: the OTB version the sids belong to. */
export type OtbLineage = {
  readonly otbMajor: number
  readonly otbMinor: number
}

export type ContentMeta = {
  readonly schema: string
  /** Client version of the DAT, e.g. 772. */
  readonly client: number
  /** DAT signature, hex. */
  readonly dat: string
  /** `null` when there is no OTB: then every item has sid = cid. */
  readonly lineage: OtbLineage | null
}

/**
 * Items as columns, one row per sid (every OTB entry; never a sid the OTB does not have).
 * Optional numbers use -1 for "none".
 */
export type ItemColumns = {
  readonly sid: number[]
  readonly cid: number[]
  readonly name: string[]
  /** `ItemFlag` bits. */
  readonly flags: number[]
  /** `FloorChange` bits. */
  readonly floorChange: number[]
  readonly groundSpeed: number[]
  readonly weight: number[]
  readonly maxItems: number[]
  readonly maxWriteLength: number[]
  readonly writableLength: number[]
  readonly writableOnceLength: number[]
  readonly rotateTo: number[]
  readonly alwaysOnTopOrder: number[]
  readonly minimapColor: number[]
  readonly lensHelp: number[]
  readonly description: string[]
  /** Row in the item appearances, or -1 when the client has no thing for the item's cid. */
  readonly appearance: number[]
}

/** Appearances as columns, one row per cid, with the sprites as the DAT lists them. */
export type AppearanceColumns = {
  readonly cid: number[]
  readonly width: number[]
  readonly height: number[]
  readonly layers: number[]
  readonly patternX: number[]
  readonly patternY: number[]
  readonly patternZ: number[]
  readonly frames: number[]
  /** Start of each row's sprites in `spriteIds`; the row's count is the next start minus this one. */
  readonly spriteStart: number[]
  readonly spriteIds: number[]
  /** `StackOrder` value. */
  readonly order: number[]
  readonly elevation: number[]
  readonly offsetX: number[]
  readonly offsetY: number[]
  /** 0 for no light. */
  readonly lightLevel: number[]
  readonly lightColor: number[]
  /** `AppearanceFlag` bits. */
  readonly flags: number[]
}

export type ContentInput = {
  dat: DatFile
  /** Without an OTB the client's items are the items, with sid = cid. */
  otb?: OtbFile
}

/** Item content without pixels: what a server or a client needs about every item. */
export type ContentJson = {
  readonly meta: ContentMeta
  readonly items: ItemColumns
  readonly appearances: AppearanceColumns
  readonly creatures: AppearanceColumns
  readonly effects: AppearanceColumns
  readonly missiles: AppearanceColumns
}

export type RgbaPage = {
  readonly width: number
  readonly height: number
  readonly rgba: Uint8Array
}

/**
 * Where each image sits in the atlas, as columns. An image left empty by trimming has `w = h = 0`
 * and page -1.
 */
export type FrameColumns = {
  readonly id: number[]
  readonly page: number[]
  readonly x: number[]
  readonly y: number[]
  readonly w: number[]
  readonly h: number[]
  /** Position of the trimmed rectangle inside the original image. */
  readonly offsetX: number[]
  readonly offsetY: number[]
}

export type AtlasOptions = {
  /** Sprite ids to pack (default: every sprite of the file). */
  ids?: Iterable<number>
  /** Largest page side in pixels (default 4096, a common GPU texture limit). */
  maxPageSize?: number
  /** Transparent pixels between images (default 1). */
  padding?: number
  /** Pack each image's non-transparent rectangle only (default false). */
  trim?: boolean
}

/** An image to place in an atlas: RGBA pixels, row by row. */
export type AtlasImage = {
  readonly width: number
  readonly height: number
  readonly rgba: Uint8Array
}

/** Where every image goes, and the pages drawn one at a time on demand. */
export type AtlasLayout = {
  readonly frames: FrameColumns
  readonly pages: readonly { readonly width: number; readonly height: number }[]
  renderPage(index: number): RgbaPage
}

/** Compresses bytes with zlib's deflate; `node:zlib` in Node, `CompressionStream('deflate')` in browsers. */
export type Deflate = (data: Uint8Array) => Uint8Array | Promise<Uint8Array>

export type SpriteSheetMeta = {
  readonly schema: string
  readonly client: number
  /** SPR signature, hex. */
  readonly spr: string
  readonly pages: readonly { readonly width: number; readonly height: number }[]
  readonly sprites: number
}

export type SpriteSheetJson = {
  readonly meta: SpriteSheetMeta
  readonly frames: FrameColumns
}

export type SpriteSheet = {
  readonly json: SpriteSheetJson
  /** One encoded PNG per page, in page order. */
  readonly pages: readonly Uint8Array[]
}

/** The sprite grid of an appearance, in the shape `spriteIndex` from `@paradoxlab/appearance` takes. */
export type AppearanceLayout = {
  readonly width: number
  readonly height: number
  readonly layers: number
  readonly patternX: number
  readonly patternY: number
  readonly patternZ: number
  readonly frames: number
}

/** One row of `AppearanceColumns`, read on demand. */
export type AppearanceView = {
  readonly row: number
  readonly cid: number
  readonly layout: AppearanceLayout
  /** Sprite ids in DAT order (a copy). */
  readonly spriteIds: number[]
  /** The sprite at `index` of `spriteIds`, without copying the list. */
  sprite(index: number): number | undefined
  /** `StackOrder` value. */
  readonly order: number
  readonly elevation: number
  readonly offset: { readonly x: number; readonly y: number }
  readonly light: { readonly level: number; readonly color: number } | null
  /** Whether an `AppearanceFlag` bit is set. */
  has(flag: number): boolean
}

/** One row of `ItemColumns`, read on demand; "none" values (-1) read as `null`. */
export type ItemView = {
  readonly row: number
  readonly sid: number
  readonly cid: number
  readonly name: string
  readonly description: string
  /** Whether an `ItemFlag` bit is set. */
  has(flag: number): boolean
  /** Whether a `FloorChange` bit is set. */
  changesFloor(direction: number): boolean
  readonly groundSpeed: number
  readonly weight: number
  readonly maxItems: number
  readonly maxWriteLength: number
  readonly writableLength: number | null
  readonly writableOnceLength: number | null
  readonly rotateTo: number | null
  readonly alwaysOnTopOrder: number
  readonly minimapColor: number | null
  readonly lensHelp: number | null
  /** `null` when the client has no thing for the item's cid. */
  readonly appearance: AppearanceView | null
}

export type ItemLookup = {
  readonly size: number
  get(sid: number): ItemView | undefined
  [Symbol.iterator](): Iterator<ItemView>
}

/** `ContentJson` indexed by sid, handing out views on demand. */
export type ContentView = {
  readonly meta: ContentMeta
  readonly items: ItemLookup
}

/** Where one sprite sits in the atlas. */
export type Frame = {
  readonly id: number
  /** -1 for a sprite left empty by trimming. */
  readonly page: number
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
  readonly offsetX: number
  readonly offsetY: number
}

export type FrameLookup = {
  readonly size: number
  get(spriteId: number): Frame | undefined
}

/** Number columns in any array-like store: JSON arrays or the loader's typed arrays. */
export type ArrayColumns<T> = { readonly [K in keyof T]: ArrayLike<number> }

/** `ItemColumns` with numbers in any array-like store: JSON arrays or the loader's typed arrays. */
export type ItemTable = {
  readonly [K in keyof ItemColumns]: ItemColumns[K] extends string[]
    ? readonly string[]
    : ArrayLike<number>
}

/**
 * Appearances of an Asset Pack, one row per client id an item uses, with the layers composed into
 * one: each sprite index of the layout (`layers` = 1) points at a row of the frame table.
 */
export type RenderAppearanceColumns = {
  readonly cid: number[]
  readonly width: number[]
  readonly height: number[]
  readonly patternX: number[]
  readonly patternY: number[]
  readonly patternZ: number[]
  readonly frames: number[]
  /** Start of each row's frames in `frameIds`. */
  readonly frameStart: number[]
  /** Row in the frame table per sprite index, in `spriteIndex` order; 0 is the empty frame. */
  readonly frameIds: number[]
  /** 1 when no frame of the appearance has a transparent pixel. */
  readonly opaque: number[]
  /** `StackOrder` value. */
  readonly order: number[]
  readonly elevation: number[]
  readonly offsetX: number[]
  readonly offsetY: number[]
  readonly lightLevel: number[]
  readonly lightColor: number[]
  /** `AppearanceFlag` bits. */
  readonly flags: number[]
}

/** Composed frames in the atlas pages; row 0 is the empty frame (page -1). */
export type RenderFrameColumns = Omit<FrameColumns, 'id'>

export type RenderJson = {
  readonly appearances: RenderAppearanceColumns
  readonly frames: RenderFrameColumns
}

export type PackManifest = {
  readonly schema: string
  readonly client: number
  /** DAT and SPR signatures, hex. */
  readonly dat: string
  readonly spr: string
  /** `null` when the pack was built without an OTB: then every item has sid = cid. */
  readonly lineage: OtbLineage | null
  readonly pages: readonly {
    readonly file: string
    readonly width: number
    readonly height: number
  }[]
  readonly counts: { readonly items: number; readonly appearances: number; readonly frames: number }
}

/** A built Asset Pack in memory: `pack.json`, `items.json`, `render.json` and the PNG pages. */
export type AssetPackFiles = {
  readonly manifest: PackManifest
  readonly items: ItemColumns
  readonly render: RenderJson
  /** Encoded PNGs, named by `manifest.pages[i].file`. */
  readonly pages: readonly Uint8Array[]
}

export type PackOptions = {
  dat: DatFile
  spr: SprFile
  otb?: OtbFile
  deflate: Deflate
  /** Largest page side (default 4096). */
  maxPageSize?: number
  /** Transparent pixels between frames (default 0; 1 or more for renderers that sample linearly). */
  padding?: number
}

/** Reads one pack file by its path relative to the pack, e.g. `pack.json`. */
export type PackReader = (path: string) => Promise<Uint8Array>

export type PackPart = 'items' | 'render'

export type LoadPackOptions = {
  /** Files to read besides `pack.json` (default both); a server needs only `items`. */
  parts?: readonly PackPart[]
  /** Called with the manifest before anything else is read; throw to stop loading. */
  check?: (manifest: PackManifest) => void
}

/** One appearance of a loaded pack, read on demand. */
export type PackAppearanceView = {
  readonly row: number
  readonly cid: number
  /** `layers` is always 1: the layers are composed into the frames. */
  readonly layout: Omit<AppearanceLayout, 'layers'>
  readonly frameCount: number
  /** Row in the frame table for a sprite index (see `spriteIndex`), 0 for the empty frame. */
  frame(index: number): number | undefined
  readonly opaque: boolean
  readonly order: number
  readonly elevation: number
  readonly offset: { readonly x: number; readonly y: number }
  readonly light: { readonly level: number; readonly color: number } | null
  has(flag: number): boolean
}

export type RenderFrameTable = {
  readonly size: number
  readonly page: Int16Array
  readonly x: Uint16Array
  readonly y: Uint16Array
  readonly w: Uint16Array
  readonly h: Uint16Array
  readonly offsetX: Uint16Array
  readonly offsetY: Uint16Array
}

export type AssetPack = {
  readonly manifest: PackManifest
  /** Present when `items` was loaded. */
  readonly items: PackItemLookup | null
  /** Present when `render` was loaded. */
  readonly appearances: {
    readonly size: number
    get(row: number): PackAppearanceView | undefined
  } | null
  readonly frames: RenderFrameTable | null
}

export type PackItemLookup = {
  readonly size: number
  /** Item columns as typed arrays (`Int32Array`, -1 for none) and names as strings. */
  readonly columns: ItemTable
  /** Appearance row per sid, -1 for an unknown sid or one without appearance. */
  readonly appearanceOfSid: Int32Array
  get(sid: number): PackItemView | undefined
  [Symbol.iterator](): Iterator<PackItemView>
}

export type PackItemView = Omit<ItemView, 'appearance'> & {
  /** `null` without `render` loaded or when the client lacks the cid. */
  readonly appearance: PackAppearanceView | null
}

export type Compatibility =
  | { readonly level: 'ok' }
  | { readonly level: 'warn'; readonly reason: string }
  | { readonly level: 'error'; readonly reason: string }

/** Composed appearances and their unique frames, before packing (internal to the pack build). */
export type ComposedAppearances = {
  readonly appearances: RenderAppearanceColumns
  /** Frames are 1..count; 0 is the empty frame and is never packed. */
  readonly frameCount: number
  /** The frame's 32x32 pixels, composed on demand. */
  imageOf(frame: number): AtlasImage
  /** 0 for frames used by grounds or borders (packed first), 1 otherwise. */
  priorityOf(frame: number): number
}
