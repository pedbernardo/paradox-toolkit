import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { serializeSpr } from '@paradox/spr'
import type { Sprite } from '@paradox/spr'
import { loadSpr, writeSpritesheet } from './spriter-io.js'
import { SPRITESHEET_SCHEMA_VERSION } from './types.js'
import type { SpritesheetOutput } from './types.js'

const FIXTURE_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../fixtures')
const SAMPLE_SPR = join(FIXTURE_DIR, 'sample.spr')
const hasSampleSpr = existsSync(SAMPLE_SPR)

let tmpDir: string

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'spriter-io-test-'))
})

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true })
})

function buildMinimalSpr(): Uint8Array {
  const sprite: Sprite = { id: 1, rgba: new Uint8Array(32 * 32 * 4), width: 32, height: 32 }
  const chunks = serializeSpr([sprite], 772)
  const total = chunks.reduce((s, c) => s + c.length, 0)
  const out = new Uint8Array(total)
  let off = 0
  for (const c of chunks) {
    out.set(c, off)
    off += c.length
  }
  return out
}

function makeOutput(overrides: Partial<SpritesheetOutput['meta']> = {}): SpritesheetOutput {
  return {
    meta: {
      schema: SPRITESHEET_SCHEMA_VERSION,
      version: 772,
      spr: '00000000',
      width: 32,
      height: 32,
      sprites: 1,
      ...overrides
    },
    png: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    positions: new Map([[1, { x: 0, y: 0 }]])
  }
}

describe('loadSpr', () => {
  it.skipIf(!hasSampleSpr)('returns ok=true with spr.count=10 for the fixture', () => {
    const result = loadSpr(SAMPLE_SPR, 772)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.spr.count).toBe(10)
  })

  it('returns ok=true for a synthetic valid SPR', () => {
    const sprPath = join(tmpDir, 'synthetic.spr')
    writeFileSync(sprPath, buildMinimalSpr())
    const result = loadSpr(sprPath, 772)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.spr.count).toBe(1)
      expect(result.spr.version).toBe(772)
    }
  })

  it('returns ok=false for a nonexistent path', () => {
    const result = loadSpr('nonexistent.spr', 772)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/not found/)
  })

  it('returns ok=false when file exists but SPR parsing throws', () => {
    const badFile = join(tmpDir, 'bad.spr')
    writeFileSync(badFile, Buffer.from([0x00, 0x01, 0x02, 0x03]))
    const result = loadSpr(badFile, 772)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/Failed to parse SPR/)
  })
})

describe('writeSpritesheet', () => {
  it('creates spritesheet.png and positions.json without versioned flag', () => {
    const result = writeSpritesheet(makeOutput(), tmpDir)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(existsSync(result.png)).toBe(true)
      expect(existsSync(result.json)).toBe(true)
      expect(result.png).toMatch(/spritesheet\.png$/)
      expect(result.json).toMatch(/positions\.json$/)
    }
  })

  it('creates versioned files when versioned=true', () => {
    const result = writeSpritesheet(makeOutput(), tmpDir, { versioned: true })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.png).toMatch(/spritesheet-772\.png$/)
      expect(result.json).toMatch(/positions-772\.json$/)
    }
  })

  it('positions.json parses as object with string keys and {x,y} values', () => {
    const result = writeSpritesheet(makeOutput(), tmpDir)
    if (!result.ok) throw new Error(result.error)

    const parsed = JSON.parse(readFileSync(result.json, 'utf8')) as unknown
    expect(typeof parsed).toBe('object')
    expect(parsed).not.toBeNull()

    const positions = (parsed as { positions: unknown }).positions
    expect(typeof positions).toBe('object')

    const firstKey = Object.keys(positions as object)[0]!
    expect(typeof firstKey).toBe('string')

    const firstVal = (positions as Record<string, unknown>)[firstKey]
    expect(firstVal).toMatchObject({ x: expect.any(Number), y: expect.any(Number) })
  })

  it('positions.json has meta with required fields', () => {
    const result = writeSpritesheet(makeOutput(), tmpDir)
    if (!result.ok) throw new Error(result.error)

    const parsed = JSON.parse(readFileSync(result.json, 'utf8')) as {
      meta: Record<string, unknown>
    }
    const { meta } = parsed
    expect(typeof meta.schema).toBe('string')
    expect(typeof meta.version).toBe('number')
    expect(typeof meta.spr).toBe('string')
    expect(typeof meta.width).toBe('number')
    expect(typeof meta.height).toBe('number')
    expect(typeof meta.sprites).toBe('number')
  })

  it('creates outDir if it does not exist', () => {
    const nested = join(tmpDir, 'nested', 'deep')
    const result = writeSpritesheet(makeOutput(), nested)
    expect(result.ok).toBe(true)
    expect(existsSync(nested)).toBe(true)
  })

  it('returns ok=false when outDir path is an existing file (mkdirSync fails)', () => {
    const blockedPath = join(tmpDir, 'not-a-dir')
    writeFileSync(blockedPath, 'x')
    const result = writeSpritesheet(makeOutput(), blockedPath)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/Failed to write spritesheet/)
  })
})
