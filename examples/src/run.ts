/* oxlint-disable no-console */
// Runs one example: `pnpm --filter @paradoxlab/examples run <example> [map.otbm]`.
// Without a map, the example runs on the generated sample map. OTBM v1 maps are not supported here:
// they need `hasInlineCount` from their items.otb (see @paradoxlab/otb `inlineCountOf`). Pack
// examples use a sample client and write the pack to the OS temp directory.
import { readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadPack } from '@paradoxlab/backpack/load'
import { fsReader } from '@paradoxlab/backpack'
import { addTileWithComposer } from './otbm-compose.js'
import { suggestCodec } from './otbm-detect-codec.js'
import { setActionId } from './otbm-edit.js'
import { otbmStats } from './otbm-stats.js'
import { upgradeToV3 } from './otbm-upgrade.js'
import { buildAssetPack } from './pack-build.js'
import { drawStack } from './pack-load.js'
import { sampleClient } from './sample-client.js'
import { sampleMap } from './sample-map.js'

const [example, path] = process.argv.slice(2)
const bytes = path === undefined ? sampleMap() : new Uint8Array(readFileSync(path))

const packDir = join(tmpdir(), 'paradoxlab-sample-pack')

const examples: Record<string, () => unknown> = {
  'pack-build': async () => (await buildAssetPack(sampleClient(), packDir)).manifest.counts,
  'pack-load': async () => {
    await buildAssetPack(sampleClient(), packDir)
    return drawStack(await loadPack(fsReader(packDir)), 2148, 7)
  },
  'otbm-stats': () => otbmStats(bytes),
  'otbm-upgrade': () => {
    const chunks = upgradeToV3(bytes)
    return { chunks: chunks.length, bytes: chunks.reduce((sum, chunk) => sum + chunk.length, 0) }
  },
  'otbm-edit': () => {
    const { changed, bytes: out } = setActionId(bytes, 1988, 2000)
    return { changed, bytes: out.length }
  },
  'otbm-compose': () => ({ bytes: addTileWithComposer(bytes).length }),
  'otbm-detect-codec': () => {
    const { codec, confidence, samples } = suggestCodec(bytes)
    return { codec: codec.name, confidence, samples }
  }
}

const run = example === undefined ? undefined : examples[example]
if (run === undefined) {
  console.error(`Usage: run.ts <${Object.keys(examples).join(' | ')}> [map.otbm]`)
  process.exit(1)
}
console.log(await run())
