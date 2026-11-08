import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { parseManifest } from './manifest.js'
import type { FixtureFile, FixtureManifest, MapFixture } from './manifest.js'

/** Absolute path plus metadata of a fixture file that exists on disk. */
export type ResolvedFile = FixtureFile & { readonly absolute: string }

export type ResolvedMap = Omit<MapFixture, 'map' | 'house' | 'spawn'> & {
  readonly map: ResolvedFile
  readonly house?: ResolvedFile
  readonly spawn?: ResolvedFile
  readonly itemsFile?: ResolvedFile
  readonly datFile?: ResolvedFile
  readonly sprFile?: ResolvedFile
}

export type Fixtures = {
  readonly root: string
  readonly manifest: FixtureManifest
  /** The map and whatever companion files exist; `undefined` if the id is unknown or the map is missing. */
  mapFixture(id: string): ResolvedMap | undefined
  /** Every map in the manifest that is present on disk, optionally filtered. */
  presentMaps(filter?: (map: MapFixture) => boolean): ResolvedMap[]
  /** An `items.otb` by id; `undefined` if unknown or missing. */
  itemsFixture(id: string): ResolvedFile | undefined
  /** A client's `.dat` and `.spr`; `undefined` if unknown or either file is missing. */
  clientFixture(id: string): { readonly dat: ResolvedFile; readonly spr: ResolvedFile } | undefined
}

/** `fixtures/` at the repository root. */
export const DEFAULT_FIXTURES_ROOT = resolve(import.meta.dirname, '..')

/** Loads the manifest under `root` and returns resolvers that only hand out files present on disk. */
export function createFixtures(root: string = DEFAULT_FIXTURES_ROOT): Fixtures {
  const manifest = parseManifest(JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8')))

  const present = (entry: FixtureFile | undefined): ResolvedFile | undefined => {
    if (entry === undefined) return undefined
    const absolute = join(root, entry.path)
    return existsSync(absolute) ? { ...entry, absolute } : undefined
  }

  const itemsFixture = (id: string): ResolvedFile | undefined => present(manifest.items[id])

  const clientFixture = (id: string) => {
    const client = manifest.clients[id]
    const dat = present(client?.dat)
    const spr = present(client?.spr)
    return dat === undefined || spr === undefined ? undefined : { dat, spr }
  }

  const resolveMap = (entry: MapFixture): ResolvedMap | undefined => {
    const map = present(entry.map)
    if (map === undefined) return undefined
    const client = entry.client === null ? undefined : clientFixture(entry.client)
    const optional = {
      house: present(entry.house),
      spawn: present(entry.spawn),
      itemsFile: itemsFixture(entry.items),
      datFile: client?.dat,
      sprFile: client?.spr
    }
    const defined = Object.fromEntries(
      Object.entries(optional).filter(([, value]) => value !== undefined)
    )
    // Only files present on disk are handed out: drop the manifest's unresolved companion entries.
    const { map: _map, house: _house, spawn: _spawn, ...metadata } = entry
    return { ...metadata, ...defined, map }
  }

  const mapFixture = (id: string): ResolvedMap | undefined => {
    const entry = manifest.maps.find((map) => map.id === id)
    return entry === undefined ? undefined : resolveMap(entry)
  }

  const presentMaps = (filter?: (map: MapFixture) => boolean): ResolvedMap[] =>
    manifest.maps
      .filter((map) => filter === undefined || filter(map))
      .map(resolveMap)
      .filter((map): map is ResolvedMap => map !== undefined)

  return { root, manifest, mapFixture, presentMaps, itemsFixture, clientFixture }
}

/** Reads a resolved fixture file as a `Uint8Array` view over the file buffer. */
export function readFixture(file: ResolvedFile): Uint8Array {
  const buffer = readFileSync(file.absolute)
  return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength)
}
