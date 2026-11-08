import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { deflateSync } from 'node:zlib'
import { Dat } from '@paradoxlab/dat'
import type { DatFile } from '@paradoxlab/dat'
import { Otb } from '@paradoxlab/otb'
import type { OtbFile } from '@paradoxlab/otb'
import { Spr } from '@paradoxlab/spr'
import type { SprFile } from '@paradoxlab/spr'
import type { AssetPackFiles, Deflate, PackReader } from './types.js'

/** `Deflate` over `node:zlib`. */
export const deflateNode: Deflate = (data) => deflateSync(data)

function readBytes(path: string, what: string): Uint8Array {
  if (!existsSync(path)) throw new Error(`${what} not found: ${path}`)
  const buffer = readFileSync(path)
  return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength)
}

export function readDat(path: string, version: number): DatFile {
  return Dat(version).load(readBytes(path, 'DAT file'))
}

export function readOtb(path: string): OtbFile {
  return Otb().load(readBytes(path, 'OTB file'))
}

export function readSpr(path: string, version: number): SprFile {
  return Spr(version).load(readBytes(path, 'SPR file'))
}

/** Writes a file, creating its directory. */
export function writeOutput(path: string, data: Uint8Array | string): void {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, data)
}

/** `PackReader` over a pack directory. */
export function fsReader(dir: string): PackReader {
  return async (path) => readBytes(join(dir, path), 'Asset pack file')
}

/** Writes `pack.json`, `items.json`, `render.json` and the pages into `dir`. */
export function writePack(dir: string, pack: AssetPackFiles): void {
  writeOutput(join(dir, 'pack.json'), `${JSON.stringify(pack.manifest, null, 2)}\n`)
  writeOutput(join(dir, 'items.json'), JSON.stringify(pack.items))
  writeOutput(join(dir, 'render.json'), JSON.stringify(pack.render))
  pack.pages.forEach((png, index) => writeOutput(join(dir, pack.manifest.pages[index]!.file), png))
}
