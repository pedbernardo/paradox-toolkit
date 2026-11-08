import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { deflateSync } from 'node:zlib'
import { Dat } from '@paradoxlab/dat'
import type { DatFile } from '@paradoxlab/dat'
import { Otb } from '@paradoxlab/otb'
import type { OtbFile } from '@paradoxlab/otb'
import { Spr } from '@paradoxlab/spr'
import type { SprFile } from '@paradoxlab/spr'
import type { Deflate } from './types.js'

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
