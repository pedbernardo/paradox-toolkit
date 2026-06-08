import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { Spr } from '../src/spr.js'

const dirname = fileURLToPath(new URL('.', import.meta.url))
const fixture = (name: string) => join(dirname, '..', 'fixtures', name)
const hasFixture = (name: string) => existsSync(fixture(name))

function loadSpr(version: number) {
  const buffer = readFileSync(fixture(`spr-${version}.spr`))
  return Spr(buffer, version)
}

const FIXTURE_VERSIONS = [710, 740, 750, 755, 760, 770, 772, 860, 870, 960, 980, 1098]

// ─── smoke: all fixture versions ─────────────────────────────────────────────

describe('smoke — all fixture versions', () => {
  for (const version of FIXTURE_VERSIONS) {
    const name = `spr-${version}.spr`
    it.skipIf(!hasFixture(name))(`spr-${version}: loads without throwing`, () => {
      const spr = loadSpr(version)
      spr.validate()
      spr.load()
      expect(spr.count).toBeGreaterThan(0)
      const sprite = spr.get(1)
      expect(sprite).toBeDefined()
      expect(sprite!.rgba.length).toBe(4096)
      expect(sprite!.width).toBe(32)
      expect(sprite!.height).toBe(32)
    })
  }
})
