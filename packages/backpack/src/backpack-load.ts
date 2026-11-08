import { ItemRow, PackAppearanceRow, rowsById } from './backpack-views.js'
import type {
  ArrayColumns,
  AssetPack,
  Compatibility,
  ItemColumns,
  ItemTable,
  LoadPackOptions,
  OtbLineage,
  PackItemLookup,
  PackItemView,
  PackManifest,
  PackReader,
  RenderFrameTable,
  RenderJson
} from './types.js'

export const PACK_SCHEMA = '1.0.0'

const utf8 = new TextDecoder()

async function readJson<T>(read: PackReader, path: string): Promise<T> {
  return JSON.parse(utf8.decode(await read(path))) as T
}

/** A reader over HTTP(S), for browsers and workers; `base` is the pack directory URL. */
export function urlReader(base: string | URL): PackReader {
  const root = new URL(String(base).endsWith('/') ? String(base) : `${String(base)}/`)
  return async (path) => {
    const response = await fetch(new URL(path, root))
    if (!response.ok) throw new Error(`Asset pack: ${path} answered HTTP ${response.status}`)
    return new Uint8Array(await response.arrayBuffer())
  }
}

const TEXT_COLUMNS = new Set<keyof ItemColumns>(['name', 'description'])

function itemTable(items: ItemColumns): ItemTable {
  const table: Record<string, ArrayLike<number> | readonly string[]> = {}
  for (const [key, values] of Object.entries(items) as [keyof ItemColumns, number[] | string[]][]) {
    table[key] = TEXT_COLUMNS.has(key) ? values : Int32Array.from(values as number[])
  }
  return table as ItemTable
}

function int32Columns<T extends Record<keyof T, number[]>>(columns: T): ArrayColumns<T> {
  const out: Record<string, Int32Array> = {}
  for (const [key, values] of Object.entries<number[]>(columns)) out[key] = Int32Array.from(values)
  return out as unknown as ArrayColumns<T>
}

function frameTable(frames: RenderJson['frames']): RenderFrameTable {
  return {
    size: frames.page.length,
    page: Int16Array.from(frames.page),
    x: Uint16Array.from(frames.x),
    y: Uint16Array.from(frames.y),
    w: Uint16Array.from(frames.w),
    h: Uint16Array.from(frames.h),
    offsetX: Uint16Array.from(frames.offsetX),
    offsetY: Uint16Array.from(frames.offsetY)
  }
}

/**
 * Loads an Asset Pack's data into typed arrays: `pack.json` first (handed to `check`, which can stop
 * the load), then `items.json` and `render.json` as asked. Pages are left to the renderer, from
 * `manifest.pages`.
 */
export async function loadPack(
  read: PackReader,
  options: LoadPackOptions = {}
): Promise<AssetPack> {
  const manifest = await readJson<PackManifest>(read, 'pack.json')
  const major = manifest.schema.split('.')[0]
  if (major !== PACK_SCHEMA.split('.')[0]) {
    throw new Error(
      `Asset pack schema ${manifest.schema} is not supported (expected ${PACK_SCHEMA})`
    )
  }
  options.check?.(manifest)
  const parts = options.parts ?? ['items', 'render']
  const [itemsJson, renderJson] = await Promise.all([
    parts.includes('items') ? readJson<ItemColumns>(read, 'items.json') : null,
    parts.includes('render') ? readJson<RenderJson>(read, 'render.json') : null
  ])

  let appearances: AssetPack['appearances'] = null
  let appearanceOf: (row: number) => PackAppearanceRow | null = () => null
  if (renderJson !== null) {
    const columns = int32Columns(renderJson.appearances)
    const size = renderJson.appearances.cid.length
    appearanceOf = (row) => new PackAppearanceRow(columns, row)
    appearances = {
      size,
      get: (row) => (row >= 0 && row < size ? new PackAppearanceRow(columns, row) : undefined)
    }
  }

  return {
    manifest,
    items: itemsJson === null ? null : itemLookup(itemTable(itemsJson), appearanceOf),
    appearances,
    frames: renderJson === null ? null : frameTable(renderJson.frames)
  }
}

function itemLookup(
  columns: ItemTable,
  appearanceOf: (row: number) => PackAppearanceRow | null
): PackItemLookup {
  const rowOfSid = rowsById(columns.sid)
  const appearanceOfSid = new Int32Array(rowOfSid.length).fill(-1)
  for (let row = 0; row < columns.sid.length; row++)
    appearanceOfSid[columns.sid[row]!] = columns.appearance[row]!
  const size = columns.sid.length
  const itemAt = (row: number): PackItemView => new ItemRow(columns, row, appearanceOf)
  return {
    size,
    columns,
    appearanceOfSid,
    get(sid) {
      const row = sid >= 0 && sid < rowOfSid.length ? rowOfSid[sid]! : -1
      return row < 0 ? undefined : itemAt(row)
    },
    *[Symbol.iterator]() {
      for (let row = 0; row < size; row++) yield itemAt(row)
    }
  }
}

/**
 * Whether a map's items match the pack, from the OTB version in the map header: same version is
 * `ok`; an older minor of the same lineage is `warn` (its sids should all exist); a newer minor or
 * another lineage is `error`. A pack built without an OTB cannot tell, so it warns.
 */
export function checkCompatibility(manifest: PackManifest, map: OtbLineage): Compatibility {
  const pack = manifest.lineage
  if (pack === null) {
    return { level: 'warn', reason: 'the pack was built without an OTB: sids are client ids' }
  }
  if (map.otbMajor !== pack.otbMajor) {
    return { level: 'error', reason: `map uses OTB ${map.otbMajor}.x, pack is ${pack.otbMajor}.x` }
  }
  if (map.otbMinor > pack.otbMinor) {
    return {
      level: 'error',
      reason: `map needs OTB ${map.otbMajor}.${map.otbMinor}, pack has ${pack.otbMajor}.${pack.otbMinor}`
    }
  }
  if (map.otbMinor < pack.otbMinor) {
    return {
      level: 'warn',
      reason: `map was saved with OTB ${map.otbMajor}.${map.otbMinor}, pack has ${pack.otbMajor}.${pack.otbMinor}`
    }
  }
  return { level: 'ok' }
}
