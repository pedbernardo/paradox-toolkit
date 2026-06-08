import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeAll, describe, expect, it } from 'vitest'
import { ParseError, UnsupportedVersionError } from '@paradox/utils'
import type { SprFile } from '../src/spr.js'
import { Spr } from '../src/spr.js'

const dirname = fileURLToPath(new URL('.', import.meta.url))
const fixture = (name: string) => join(dirname, '..', 'fixtures', name)
const hasFixture = (name: string) => existsSync(fixture(name))

const FIXTURE_772 = 'spr-772.spr'

function readFixture(version: number): ArrayBuffer {
  const buf = readFileSync(fixture(`spr-${version}.spr`))
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer
}

function loadSpr(version: number): SprFile {
  return Spr(version).load(readFixture(version))
}

// ─── spr-772 smoke ────────────────────────────────────────────────────────────

describe.skipIf(!hasFixture(FIXTURE_772))('spr-772: smoke', () => {
  it('loads and validates without throwing', () => {
    const buffer = readFixture(772)
    Spr(772).validate(buffer)
    const file = Spr(772).load(buffer)
    expect(file.count).toBeGreaterThan(0)
    const sprite = file.get(1)
    expect(sprite).toBeDefined()
    expect(sprite!.rgba.length).toBe(4096)
    expect(sprite!.width).toBe(32)
    expect(sprite!.height).toBe(32)
  })
})

// ─── signature validation ─────────────────────────────────────────────────────

describe.skipIf(!hasFixture(FIXTURE_772))('signature validation', () => {
  it('validate() throws ParseError when buffer version does not match', () => {
    expect(() => Spr(710).validate(readFixture(772))).toThrow(ParseError)
  })

  it('constructor throws UnsupportedVersionError for unsupported version', () => {
    expect(() => Spr(999)).toThrow(UnsupportedVersionError)
  })
})

// ─── spr-772 concrete values ──────────────────────────────────────────────────

describe.skipIf(!hasFixture(FIXTURE_772))('spr-772: concrete values', () => {
  let file: SprFile

  beforeAll(() => {
    file = loadSpr(772)
  })

  it('has correct signature', () => {
    expect(file.signature).toBe(0x439852be)
  })

  it('has expected sprite count', () => {
    expect(file.count).toBe(10962)
  })

  it('get(1) returns a sprite with id 1', () => {
    expect(file.get(1)?.id).toBe(1)
  })

  it('get(2) has non-zero pixels (sprite 2 has color data)', () => {
    expect(file.get(2)!.rgba.some((b) => b !== 0)).toBe(true)
  })

  it('get() returns undefined for id > count', () => {
    expect(file.get(file.count + 1)).toBeUndefined()
  })

  it('entries() iterates all sprites', () => {
    let count = 0
    for (const [id, sprite] of file.entries()) {
      expect(id).toBe(sprite.id)
      count++
    }
    expect(count).toBe(file.count)
  })
})
