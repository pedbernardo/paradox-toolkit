/* oxlint-disable no-console */
// Fills `scan` in fixtures/manifest.json for every map present on disk.
// Usage: pnpm --filter @paradoxlab/fixtures scan
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { DEFAULT_FIXTURES_ROOT, createFixtures, readFixture } from './resolve.js'
import { scanOtbm } from './scan.js'

const manifestPath = join(DEFAULT_FIXTURES_ROOT, 'manifest.json')
const raw = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
  maps: { id: string; scan?: unknown }[]
}
const fixtures = createFixtures()

for (const entry of raw.maps) {
  const map = fixtures.mapFixture(entry.id)
  if (map === undefined) {
    console.log(`${entry.id}: not present, scan kept as is`)
    continue
  }
  entry.scan = scanOtbm(readFixture(map.map))
  console.log(`${entry.id}: ${JSON.stringify(entry.scan)}`)
}

writeFileSync(manifestPath, `${JSON.stringify(raw, null, 2)}\n`)
