import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { Dat } from '@paradox/dat'
import { Otb } from '@paradox/otb'
import { loadInputs, writeContent } from './thinger-io.js'
import type { ContentDefinitions } from './types.js'

function buildMinimalDat(): Uint8Array {
  return Dat(772).write({ version: 772, signature: 0, things: [] })
}

function buildMinimalOtb(): Uint8Array {
  return Otb().write({ items: [], schemaVersion: '3.57.0' })
}

const stubContent: ContentDefinitions = {
  meta: {
    schema: '1.0.0',
    version: 772,
    dat: '00000000',
    otb: '1.0.0',
    counts: { items: 1, creatures: 0, effects: 0, missiles: 0 }
  },
  items: [],
  creatures: [],
  effects: [],
  missiles: []
}

describe('loadInputs - missing files', () => {
  it('returns error when DAT file does not exist', () => {
    const result = loadInputs('/nonexistent/file.dat', '/nonexistent/file.otb', 772)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/DAT file not found/)
  })

  it('returns error when OTB file does not exist', () => {
    const tempDat = resolve(tmpdir(), `thinger-dat-${Date.now()}.dat`)
    writeFileSync(tempDat, buildMinimalDat())
    const result = loadInputs(tempDat, '/nonexistent/file.otb', 772)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/OTB file not found/)
  })

  it('error message includes the missing path', () => {
    const missing = '/no/such/path.dat'
    const result = loadInputs(missing, '/nonexistent/file.otb', 772)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain(missing)
  })
})

describe('loadInputs - parse error', () => {
  it('returns error when inputs fail to parse', () => {
    const tempDat = resolve(tmpdir(), `thinger-bad-dat-${Date.now()}.dat`)
    const tempOtb = resolve(tmpdir(), `thinger-bad-otb-${Date.now()}.otb`)
    writeFileSync(tempDat, Buffer.from([0x00, 0x01, 0x02, 0x03]))
    writeFileSync(tempOtb, Buffer.from([0x00, 0x01, 0x02, 0x03]))
    const result = loadInputs(tempDat, tempOtb, 772)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/Failed to parse inputs/)
  })
})

describe('loadInputs - valid files', () => {
  it('returns ok with parsed dat and otb', () => {
    const tempDat = resolve(tmpdir(), `thinger-dat-${Date.now()}.dat`)
    const tempOtb = resolve(tmpdir(), `thinger-otb-${Date.now()}.otb`)
    writeFileSync(tempDat, buildMinimalDat())
    writeFileSync(tempOtb, buildMinimalOtb())
    const result = loadInputs(tempDat, tempOtb, 772)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.dat.version).toBe(772)
      expect(typeof result.otb.schemaVersion).toBe('string')
    }
  })
})

describe('writeContent', () => {
  it('returns ok and writes content.json to the output directory', () => {
    const outDir = resolve(tmpdir(), `thinger-test-${Date.now()}`)
    const result = writeContent(stubContent, outDir)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.path).toMatch(/content\.json$/)
      expect(existsSync(result.path)).toBe(true)
    }
  })

  it('written file is valid JSON matching the input', () => {
    const outDir = resolve(tmpdir(), `thinger-test-${Date.now()}`)
    const result = writeContent(stubContent, outDir)
    if (result.ok) {
      const parsed = JSON.parse(readFileSync(result.path, 'utf8'))
      expect(parsed.meta.schema).toBe('1.0.0')
      expect(parsed.meta.version).toBe(772)
    }
  })

  it('creates nested output directories that do not exist', () => {
    const outDir = resolve(tmpdir(), `thinger-test-${Date.now()}`, 'deep', 'nested')
    const result = writeContent(stubContent, outDir)
    expect(result.ok).toBe(true)
    if (result.ok) expect(existsSync(result.path)).toBe(true)
  })

  it('pretty option produces indented JSON', () => {
    const outDir = resolve(tmpdir(), `thinger-test-${Date.now()}`)
    writeContent(stubContent, outDir, { pretty: true })
    const raw = readFileSync(resolve(outDir, 'content.json'), 'utf8')
    expect(raw).toContain('\n  ')
  })

  it('returns ok=false when outDir path is an existing file', () => {
    const blocked = resolve(tmpdir(), `thinger-blocked-${Date.now()}`)
    writeFileSync(blocked, 'x')
    const result = writeContent(stubContent, blocked)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/Failed to write output/)
  })
})
