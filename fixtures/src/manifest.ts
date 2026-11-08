/** A file inside `fixtures/`, with its path relative to that directory. */
export type FixtureFile = {
  readonly path: string
  readonly bytes: number
}

export type ItemsFixture = FixtureFile & {
  /** Version string read from the OTB header, e.g. `OTB 1.3.46-7.60`. */
  readonly version: string
}

export type ClientFixture = {
  readonly dat: FixtureFile
  readonly spr: FixtureFile
}

/**
 * Structural facts of a map, measured by a byte scan that does not use any OTBM reader
 * (`src/scan.ts`). Readers are checked against these numbers.
 */
export type MapScan = {
  /** Tile and house-tile nodes inside a tile area. */
  readonly tiles: number
  /** Tile or house-tile nodes found anywhere else (malformed files). */
  readonly strayTiles: number
  readonly houseTiles: number
  /** Item nodes, at any depth (inline tile items are not nodes). */
  readonly itemNodes: number
  readonly areas: number
  readonly towns: number
  readonly waypoints: number
  readonly maxDepth: number
  readonly maxItemNesting: number
  readonly maxItemNodesPerTile: number
  readonly maxContainerChildren: number
  readonly maxTilesPerArea: number
  /** Largest unescaped property block of any node, in bytes. */
  readonly maxNodeProps: number
}

export type MapFixture = {
  readonly id: string
  readonly purpose: string
  /** OTBM format version (1 to 4). */
  readonly otbm: number
  /** Id of the matching entry in `items`. */
  readonly items: string
  /** Id of the matching entry in `clients`, when render assets exist. */
  readonly client: string | null
  readonly tags: readonly string[]
  /** Public fixtures (`*.fixture.*`) are versioned; the rest stay local. */
  readonly public: boolean
  readonly map: FixtureFile
  readonly house?: FixtureFile
  readonly spawn?: FixtureFile
  readonly scan?: MapScan
}

export type FixtureManifest = {
  readonly schema: number
  readonly items: Readonly<Record<string, ItemsFixture>>
  readonly clients: Readonly<Record<string, ClientFixture>>
  readonly maps: readonly MapFixture[]
}

export const MANIFEST_SCHEMA = 1

export class ManifestError extends Error {
  override name = 'ManifestError'
}

type Json = Record<string, unknown>

const SCAN_KEYS = [
  'tiles',
  'strayTiles',
  'houseTiles',
  'itemNodes',
  'areas',
  'towns',
  'waypoints',
  'maxDepth',
  'maxItemNesting',
  'maxItemNodesPerTile',
  'maxContainerChildren',
  'maxTilesPerArea',
  'maxNodeProps'
] as const satisfies readonly (keyof MapScan)[]

function isObject(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function fail(where: string, message: string): never {
  throw new ManifestError(`${where}: ${message}`)
}

function str(obj: Json, key: string, where: string): string {
  const value = obj[key]
  if (typeof value !== 'string' || value.length === 0) {
    fail(where, `"${key}" must be a non-empty string`)
  }
  return value
}

function num(obj: Json, key: string, where: string): number {
  const value = obj[key]
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(where, `"${key}" must be a number`)
  return value
}

function file(value: unknown, where: string): FixtureFile {
  if (!isObject(value)) fail(where, 'must be an object')
  return { path: str(value, 'path', where), bytes: num(value, 'bytes', where) }
}

function record<T>(
  value: unknown,
  where: string,
  parse: (entry: unknown, at: string) => T
): Record<string, T> {
  if (!isObject(value)) fail(where, 'must be an object')
  const out: Record<string, T> = {}
  for (const [id, entry] of Object.entries(value)) out[id] = parse(entry, `${where}.${id}`)
  return out
}

function parseScan(value: unknown, where: string): MapScan {
  if (!isObject(value)) fail(where, 'must be an object')
  const scan: Record<string, number> = {}
  for (const key of SCAN_KEYS) scan[key] = num(value, key, where)
  return scan as MapScan
}

function parseMap(value: unknown, where: string): MapFixture {
  if (!isObject(value)) fail(where, 'must be an object')
  const client = value['client']
  if (client !== null && typeof client !== 'string') {
    fail(where, '"client" must be a string or null')
  }
  const tags = value['tags']
  if (!Array.isArray(tags) || !tags.every((tag) => typeof tag === 'string')) {
    fail(where, '"tags" must be a string array')
  }
  return {
    id: str(value, 'id', where),
    purpose: str(value, 'purpose', where),
    otbm: num(value, 'otbm', where),
    items: str(value, 'items', where),
    client,
    tags,
    public: value['public'] === true,
    map: file(value['map'], `${where}.map`),
    ...(value['house'] === undefined ? {} : { house: file(value['house'], `${where}.house`) }),
    ...(value['spawn'] === undefined ? {} : { spawn: file(value['spawn'], `${where}.spawn`) }),
    ...(value['scan'] === undefined ? {} : { scan: parseScan(value['scan'], `${where}.scan`) })
  }
}

/** Validates the manifest shape and its internal references. Throws `ManifestError` on the first problem. */
export function parseManifest(json: unknown): FixtureManifest {
  if (!isObject(json)) fail('manifest', 'must be an object')
  const schema = num(json, 'schema', 'manifest')
  if (schema !== MANIFEST_SCHEMA) fail('manifest', `unsupported schema ${schema}`)

  const items = record(json['items'], 'items', (entry, at) => {
    if (!isObject(entry)) fail(at, 'must be an object')
    return { ...file(entry, at), version: str(entry, 'version', at) }
  })
  const clients = record(json['clients'], 'clients', (entry, at) => {
    if (!isObject(entry)) fail(at, 'must be an object')
    return { dat: file(entry['dat'], `${at}.dat`), spr: file(entry['spr'], `${at}.spr`) }
  })

  const rawMaps = json['maps']
  if (!Array.isArray(rawMaps)) fail('maps', 'must be an array')
  const maps = rawMaps.map((entry, index) => parseMap(entry, `maps[${index}]`))

  const seen = new Set<string>()
  for (const map of maps) {
    if (seen.has(map.id)) fail(`maps.${map.id}`, 'duplicate id')
    seen.add(map.id)
    if (items[map.items] === undefined) fail(`maps.${map.id}`, `unknown items "${map.items}"`)
    if (map.client !== null && clients[map.client] === undefined) {
      fail(`maps.${map.id}`, `unknown client "${map.client}"`)
    }
  }

  return { schema, items, clients, maps }
}
