import type {
  ArrayColumns,
  AppearanceColumns,
  AppearanceLayout,
  AppearanceView,
  ContentJson,
  ContentView,
  Frame,
  FrameColumns,
  FrameLookup,
  ItemTable,
  ItemView,
  PackAppearanceView,
  RenderAppearanceColumns
} from './types.js'

const orNull = (value: number): number | null => (value < 0 ? null : value)

/** Row of each small non-negative id, -1 for none: one typed array instead of a Map. */
export function rowsById(ids: ArrayLike<number>): Int32Array {
  let max = -1
  for (let row = 0; row < ids.length; row++) if (ids[row]! > max) max = ids[row]!
  const rowOf = new Int32Array(max + 1).fill(-1)
  for (let row = 0; row < ids.length; row++) rowOf[ids[row]!] = row
  return rowOf
}

function rowIndex(ids: ArrayLike<number>): (id: number) => number {
  const rowOf = rowsById(ids)
  return (id) => (id >= 0 && id < rowOf.length ? rowOf[id]! : -1)
}

class AppearanceRow implements AppearanceView {
  constructor(
    private readonly columns: AppearanceColumns,
    readonly row: number
  ) {}

  get cid(): number {
    return this.columns.cid[this.row]!
  }

  get layout(): AppearanceLayout {
    const c = this.columns
    const row = this.row
    return {
      width: c.width[row]!,
      height: c.height[row]!,
      layers: c.layers[row]!,
      patternX: c.patternX[row]!,
      patternY: c.patternY[row]!,
      patternZ: c.patternZ[row]!,
      frames: c.frames[row]!
    }
  }

  private get spriteEnd(): number {
    return this.columns.spriteStart[this.row + 1] ?? this.columns.spriteIds.length
  }

  get spriteIds(): number[] {
    return this.columns.spriteIds.slice(this.columns.spriteStart[this.row]!, this.spriteEnd)
  }

  sprite(index: number): number | undefined {
    const at = this.columns.spriteStart[this.row]! + index
    return index >= 0 && at < this.spriteEnd ? this.columns.spriteIds[at] : undefined
  }

  get order(): number {
    return this.columns.order[this.row]!
  }

  get elevation(): number {
    return this.columns.elevation[this.row]!
  }

  get offset(): { x: number; y: number } {
    return { x: this.columns.offsetX[this.row]!, y: this.columns.offsetY[this.row]! }
  }

  get light(): { level: number; color: number } | null {
    const level = this.columns.lightLevel[this.row]!
    return level === 0 ? null : { level, color: this.columns.lightColor[this.row]! }
  }

  has(flag: number): boolean {
    return (this.columns.flags[this.row]! & flag) !== 0
  }
}

/** Item columns of a content file or a loaded pack; `appearanceOf` turns an appearance row into its view. */
export class ItemRow<A> {
  constructor(
    private readonly columns: ItemTable,
    readonly row: number,
    private readonly appearanceOf: (row: number) => A | null
  ) {}

  get sid(): number {
    return this.columns.sid[this.row]!
  }

  get cid(): number {
    return this.columns.cid[this.row]!
  }

  get name(): string {
    return this.columns.name[this.row]!
  }

  get description(): string {
    return this.columns.description[this.row]!
  }

  has(flag: number): boolean {
    return (this.columns.flags[this.row]! & flag) !== 0
  }

  changesFloor(direction: number): boolean {
    return (this.columns.floorChange[this.row]! & direction) !== 0
  }

  get groundSpeed(): number {
    return this.columns.groundSpeed[this.row]!
  }

  get weight(): number {
    return this.columns.weight[this.row]!
  }

  get maxItems(): number {
    return this.columns.maxItems[this.row]!
  }

  get maxWriteLength(): number {
    return this.columns.maxWriteLength[this.row]!
  }

  get writableLength(): number | null {
    return orNull(this.columns.writableLength[this.row]!)
  }

  get writableOnceLength(): number | null {
    return orNull(this.columns.writableOnceLength[this.row]!)
  }

  get rotateTo(): number | null {
    return orNull(this.columns.rotateTo[this.row]!)
  }

  get alwaysOnTopOrder(): number {
    return this.columns.alwaysOnTopOrder[this.row]!
  }

  get minimapColor(): number | null {
    return orNull(this.columns.minimapColor[this.row]!)
  }

  get lensHelp(): number | null {
    return orNull(this.columns.lensHelp[this.row]!)
  }

  get appearance(): A | null {
    const row = this.columns.appearance[this.row]!
    return row < 0 ? null : this.appearanceOf(row)
  }
}

export class PackAppearanceRow implements PackAppearanceView {
  constructor(
    private readonly columns: ArrayColumns<RenderAppearanceColumns>,
    readonly row: number
  ) {}

  get cid(): number {
    return this.columns.cid[this.row]!
  }

  get layout(): Omit<AppearanceLayout, 'layers'> {
    const c = this.columns
    const row = this.row
    return {
      width: c.width[row]!,
      height: c.height[row]!,
      patternX: c.patternX[row]!,
      patternY: c.patternY[row]!,
      patternZ: c.patternZ[row]!,
      frames: c.frames[row]!
    }
  }

  get frameCount(): number {
    const end = this.columns.frameStart[this.row + 1] ?? this.columns.frameIds.length
    return end - this.columns.frameStart[this.row]!
  }

  frame(index: number): number | undefined {
    return index >= 0 && index < this.frameCount
      ? this.columns.frameIds[this.columns.frameStart[this.row]! + index]
      : undefined
  }

  get opaque(): boolean {
    return this.columns.opaque[this.row] === 1
  }

  get order(): number {
    return this.columns.order[this.row]!
  }

  get elevation(): number {
    return this.columns.elevation[this.row]!
  }

  get offset(): { x: number; y: number } {
    return { x: this.columns.offsetX[this.row]!, y: this.columns.offsetY[this.row]! }
  }

  get light(): { level: number; color: number } | null {
    const level = this.columns.lightLevel[this.row]!
    return level === 0 ? null : { level, color: this.columns.lightColor[this.row]! }
  }

  has(flag: number): boolean {
    return (this.columns.flags[this.row]! & flag) !== 0
  }
}

/** Indexes content by sid once; views read the columns only when asked. */
export function viewContent(content: ContentJson): ContentView {
  const rowOf = rowIndex(content.items.sid)
  const size = content.items.sid.length
  const appearanceOf = (row: number): AppearanceView => new AppearanceRow(content.appearances, row)
  const itemAt = (row: number): ItemView => new ItemRow(content.items, row, appearanceOf)
  return {
    meta: content.meta,
    items: {
      size,
      get(sid) {
        const row = rowOf(sid)
        return row < 0 ? undefined : itemAt(row)
      },
      *[Symbol.iterator]() {
        for (let row = 0; row < size; row++) yield itemAt(row)
      }
    }
  }
}

/** Indexes atlas frames by sprite id once. */
export function viewFrames(frames: FrameColumns): FrameLookup {
  const rowOf = rowIndex(frames.id)
  return {
    size: frames.id.length,
    get(spriteId): Frame | undefined {
      const row = rowOf(spriteId)
      if (row < 0) return undefined
      return {
        id: spriteId,
        page: frames.page[row]!,
        x: frames.x[row]!,
        y: frames.y[row]!,
        w: frames.w[row]!,
        h: frames.h[row]!,
        offsetX: frames.offsetX[row]!,
        offsetY: frames.offsetY[row]!
      }
    }
  }
}
