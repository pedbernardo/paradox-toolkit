import type {
  OtbmCompareOptions,
  OtbmDifference,
  OtbmDocument,
  OtbmDocumentEntry,
  OtbmDocumentNode,
  OtbmDocumentTile,
  OtbmItemAttribute
} from './types.js'

const DEFAULT_LIMIT = 100

const bytesKey = (bytes: Uint8Array | null): string | null =>
  bytes === null ? null : [...bytes].join(',')

/** An attribute as plain comparable data; byte tails as text. */
const attributeKey = (attribute: OtbmItemAttribute): string =>
  attribute.kind === 'unknown' ? `unknown:${bytesKey(attribute.bytes)}` : JSON.stringify(attribute)

function* tilesOf(document: OtbmDocument): Generator<OtbmDocumentTile> {
  for (const group of [document.beforeMapData, document.entries, document.afterMapData]) {
    for (const entry of group) {
      if (entry.kind !== 'area') continue
      for (const tile of entry.tiles) if (tile.kind === 'tile') yield tile
    }
  }
}

/** Unknown nodes outside tiles, and the town and waypoint lists, in file order. */
function structureOf(document: OtbmDocument): string[] {
  const out: string[] = []
  const visit = (entries: readonly OtbmDocumentEntry[], where: string): void => {
    for (const entry of entries) {
      if (entry.kind === 'unknown') {
        out.push(`${where} unknown ${entry.type} ${bytesKey(entry.raw)}`)
      } else if (entry.kind === 'list') {
        for (const child of entry.children) {
          if (child.kind === 'unknown') out.push(`${entry.list} unknown ${bytesKey(child.raw)}`)
          else out.push(`${child.kind} ${JSON.stringify({ ...child, tail: bytesKey(child.tail) })}`)
        }
      } else {
        for (const tile of entry.tiles) {
          if (tile.kind === 'unknown') out.push(`area unknown ${tile.type} ${bytesKey(tile.raw)}`)
        }
      }
    }
  }
  visit(document.beforeMapData, 'root')
  visit(document.entries, 'map data')
  visit(document.afterMapData, 'root')
  return out
}

/**
 * Lists what two maps mean differently, ignoring the Shape: inline vs node items, attribute order,
 * area layout and tile order, and a flags attribute of 0 vs no flags. Tiles are matched by position;
 * items by their order on the tile.
 */
export function compareOtbm(
  a: OtbmDocument,
  b: OtbmDocument,
  options: OtbmCompareOptions = {}
): OtbmDifference[] {
  const limit = options.limit ?? DEFAULT_LIMIT
  const differences: OtbmDifference[] = []
  const add = (path: string, left: unknown, right: unknown): void => {
    if (differences.length < limit) differences.push({ path, a: left, b: right })
  }
  const same = (path: string, left: unknown, right: unknown): void => {
    if (JSON.stringify(left) !== JSON.stringify(right)) add(path, left, right)
  }

  for (const field of ['version', 'width', 'height', 'otbMajor', 'otbMinor'] as const) {
    same(`header ${field}`, a.header[field], b.header[field])
  }
  const mapDataKeys = (document: OtbmDocument) =>
    document.mapData.attributes.map((attribute) =>
      attribute.kind === 'unknown'
        ? `unknown:${bytesKey(attribute.bytes)}`
        : `${attribute.kind}:${attribute.value}`
    )
  same('map data', mapDataKeys(a), mapDataKeys(b))
  same('structure', structureOf(a), structureOf(b))

  const compareNodes = (
    path: string,
    left: readonly OtbmDocumentNode[],
    right: readonly OtbmDocumentNode[]
  ): void => {
    if (left.length !== right.length) add(`${path} items`, left.length, right.length)
    const count = Math.min(left.length, right.length)
    for (let i = 0; i < count && differences.length < limit; i++) {
      const x = left[i]!
      const y = right[i]!
      const at = `${path} item ${i}`
      if (x.kind !== y.kind) {
        add(`${at} kind`, x.kind, y.kind)
        continue
      }
      if (x.kind === 'unknown' || y.kind === 'unknown') {
        same(
          `${at} unknown`,
          bytesKey((x as { raw: Uint8Array }).raw),
          bytesKey((y as { raw: Uint8Array }).raw)
        )
        continue
      }
      same(`${at} sid`, x.sid, y.sid)
      same(
        `${at} attributes`,
        (x.attributes ?? []).map(attributeKey).sort(),
        (y.attributes ?? []).map(attributeKey).sort()
      )
      compareNodes(at, x.children ?? [], y.children ?? [])
    }
  }

  const right = new Map<string, OtbmDocumentTile>()
  for (const tile of tilesOf(b)) right.set(`${tile.x},${tile.y},${tile.z}`, tile)
  for (const tile of tilesOf(a)) {
    if (differences.length >= limit) break
    const key = `${tile.x},${tile.y},${tile.z}`
    const other = right.get(key)
    if (other === undefined) {
      add(`tile ${key}`, 'present', 'missing')
      continue
    }
    right.delete(key)
    const path = `tile ${key}`
    same(`${path} flags`, tile.flags ?? 0, other.flags ?? 0)
    same(`${path} houseId`, tile.houseId, other.houseId)
    same(`${path} tail`, bytesKey(tile.tail), bytesKey(other.tail))
    compareNodes(path, tile.items, other.items)
  }
  for (const key of right.keys()) add(`tile ${key}`, 'missing', 'present')

  return differences
}
