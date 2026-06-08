import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { Otb } from '../src/otb.js'
import { ITEM_GROUP } from '../src/otb-config.js'

const dirname = fileURLToPath(new URL('.', import.meta.url))
const fixture = (name: string) => join(dirname, '..', 'fixtures', name)

function readBuffer(version: number): ArrayBuffer {
  const buf = readFileSync(fixture(`items-${version}.otb`))
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer
}

function loadOtb(version: number) {
  return Otb().load(readBuffer(version))
}

const FIXTURE_VERSIONS = [740, 760, 772, 860, 870, 960, 1098]

// ─── smoke: all versions ──────────────────────────────────────────────────────

describe('smoke — all fixture versions', () => {
  for (const version of FIXTURE_VERSIONS) {
    it(`items-${version}: loads and validates without throwing`, () => {
      const buffer = readBuffer(version)
      expect(() => Otb().validate(buffer)).not.toThrow()
      const file = Otb().load(buffer)
      expect(file.count).toBeGreaterThan(0)
      expect(file.get(100)).toBeDefined()
      expect(file.get(100)!.group).not.toBe(ITEM_GROUP.DEPRECATED)
    })
  }
})

describe('smoke — all versions: schemaVersion is valid', () => {
  for (const version of FIXTURE_VERSIONS) {
    it(`items-${version}: schemaVersion major is a known OTB version`, () => {
      const file = loadOtb(version)
      const major = parseInt(file.schemaVersion.split('.')[0]!, 10)
      expect([1, 2, 3]).toContain(major)
    })
  }
})

describe('smoke — all versions: entries() is consistent with count and get()', () => {
  for (const version of FIXTURE_VERSIONS) {
    it(`items-${version}: entries() count matches file.count`, () => {
      const file = loadOtb(version)
      let n = 0
      for (const [sid, item] of file.entries()) {
        expect(file.get(sid)).toBe(item)
        n++
      }
      expect(n).toBe(file.count)
    })
  }
})

// ─── items-960 concrete values ────────────────────────────────────────────────

describe('items-960 concrete values', () => {
  const file = loadOtb(960)

  it('schemaVersion is 3.x.x', () => {
    expect(file.schemaVersion.startsWith('3.')).toBe(true)
  })

  it('count is greater than 5000', () => {
    expect(file.count).toBeGreaterThan(5000)
  })

  it('item 100 is in GROUND group', () => {
    expect(file.get(100)!.group).toBe(ITEM_GROUP.GROUND)
  })

  it('item 100 has a non-zero cid', () => {
    expect(file.get(100)!.cid).toBeGreaterThan(0)
  })

  it('all items have groups within the valid range (not DEPRECATED)', () => {
    for (const [, item] of file.entries()) {
      expect(item.group).toBeGreaterThanOrEqual(ITEM_GROUP.NONE)
      expect(item.group).toBeLessThan(ITEM_GROUP.DEPRECATED)
    }
  })

  it('all entries have sid matching their map key', () => {
    for (const [sid, item] of file.entries()) {
      expect(item.sid).toBe(sid)
    }
  })
})
