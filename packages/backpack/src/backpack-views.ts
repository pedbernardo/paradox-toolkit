import type {
  AppearanceColumns,
  AppearanceLayout,
  AppearanceView,
  ContentJson,
  ContentView,
  Frame,
  FrameColumns,
  FrameLookup,
  ItemColumns,
  ItemView
} from './types.js'

const orNull = (value: number): number | null => (value < 0 ? null : value)

/** A table keyed by small non-negative ids: one typed array instead of a Map. */
function rowIndex(ids: readonly number[]): (id: number) => number {
  let max = -1
  for (const id of ids) if (id > max) max = id
  const rowOf = new Int32Array(max + 1).fill(-1)
  for (let row = 0; row < ids.length; row++) rowOf[ids[row]!] = row
  return (id) => (id >= 0 && id <= max ? rowOf[id]! : -1)
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

class ItemRow implements ItemView {
  private readonly columns: ItemColumns

  constructor(
    private readonly content: ContentJson,
    readonly row: number
  ) {
    this.columns = content.items
  }

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

  get appearance(): AppearanceView | null {
    const row = this.columns.appearance[this.row]!
    return row < 0 ? null : new AppearanceRow(this.content.appearances, row)
  }
}

/** Indexes content by sid once; views read the columns only when asked. */
export function viewContent(content: ContentJson): ContentView {
  const rowOf = rowIndex(content.items.sid)
  const size = content.items.sid.length
  return {
    meta: content.meta,
    items: {
      size,
      get(sid) {
        const row = rowOf(sid)
        return row < 0 ? undefined : new ItemRow(content, row)
      },
      *[Symbol.iterator]() {
        for (let row = 0; row < size; row++) yield new ItemRow(content, row)
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
