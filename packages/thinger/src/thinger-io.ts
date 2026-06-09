import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { Dat } from '@paradoxlab/dat'
import { Otb } from '@paradoxlab/otb'
import type { DatFile } from '@paradoxlab/dat'
import type { OtbFile } from '@paradoxlab/otb'
import type { ContentDefinitions } from './types.js'

export type LoadResult = { ok: true; dat: DatFile; otb: OtbFile } | { ok: false; error: string }

export type WriteResult = { ok: true; path: string } | { ok: false; error: string }

export function loadInputs(datPath: string, otbPath: string, version: number): LoadResult {
  if (!existsSync(datPath)) return { ok: false, error: `DAT file not found: ${datPath}` }
  if (!existsSync(otbPath)) return { ok: false, error: `OTB file not found: ${otbPath}` }

  try {
    const datBuf = readFileSync(datPath)
    const otbBuf = readFileSync(otbPath)
    const datBuffer = datBuf.buffer.slice(datBuf.byteOffset, datBuf.byteOffset + datBuf.byteLength)
    const otbBuffer = otbBuf.buffer.slice(otbBuf.byteOffset, otbBuf.byteOffset + otbBuf.byteLength)
    const dat = Dat(version).load(datBuffer as ArrayBuffer)
    const otb = Otb().load(otbBuffer as ArrayBuffer)
    return { ok: true, dat, otb }
  } catch (err) {
    return {
      ok: false,
      error: `Failed to parse inputs: ${err instanceof Error ? err.message : String(err)}`
    }
  }
}

export function writeContent(
  content: ContentDefinitions,
  outDir: string,
  opts: { pretty?: boolean } = {}
): WriteResult {
  try {
    mkdirSync(outDir, { recursive: true })
    const outPath = resolve(outDir, 'content.json')
    writeFileSync(outPath, JSON.stringify(content, null, opts.pretty ? 2 : 0))
    return { ok: true, path: outPath }
  } catch (err) {
    return {
      ok: false,
      error: `Failed to write output: ${err instanceof Error ? err.message : String(err)}`
    }
  }
}
