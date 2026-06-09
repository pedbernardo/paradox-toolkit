import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { Spr } from '@paradoxlab/spr'
import type { SprFile } from '@paradoxlab/spr'
import type { SpritesheetJson, SpritesheetOutput } from './types.js'

export type LoadResult = { ok: true; spr: SprFile } | { ok: false; error: string }
export type WriteResult = { ok: true; png: string; json: string } | { ok: false; error: string }

export function loadSpr(sprPath: string, version: number): LoadResult {
  if (!existsSync(sprPath)) {
    return { ok: false, error: `SPR file not found: ${sprPath}` }
  }

  try {
    const buf = readFileSync(sprPath)
    const buffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
    const factory = Spr(version)
    factory.validate(buffer)
    const spr = factory.load(buffer)
    return { ok: true, spr }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { ok: false, error: `Failed to parse SPR: ${message}` }
  }
}

export function writeSpritesheet(
  output: SpritesheetOutput,
  outDir: string,
  opts: { versioned?: boolean } = {}
): WriteResult {
  try {
    mkdirSync(outDir, { recursive: true })

    const suffix = opts.versioned ? `-${output.meta.version}` : ''
    const pngPath = join(outDir, `spritesheet${suffix}.png`)
    const jsonPath = join(outDir, `positions${suffix}.json`)

    writeFileSync(pngPath, output.png)

    const positionsRecord: Record<string, { x: number; y: number }> = {}
    for (const [id, pos] of output.positions) {
      positionsRecord[String(id)] = pos
    }

    const json: SpritesheetJson = {
      meta: output.meta,
      positions: positionsRecord
    }

    writeFileSync(jsonPath, JSON.stringify(json, null, 2))

    return { ok: true, png: pngPath, json: jsonPath }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { ok: false, error: `Failed to write spritesheet: ${message}` }
  }
}
