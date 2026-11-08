/* oxlint-disable no-console */
// One sprite-sheet build in a fresh process: `node bench/measure-sprites.ts <backpack|backpack-trim> <client>`.
import { fixtures, readFixture } from '@paradoxlab/fixtures'
import { Spr } from '@paradoxlab/spr'
import { buildSpriteSheet } from '../src/backpack-sprites.js'
import { deflateNode } from '../src/backpack-node.js'

const [tool, client] = process.argv.slice(2) as [string, string]
const files = fixtures().clientFixture(client)
if (files === undefined) {
  console.log(JSON.stringify({ tool, client, skipped: true }))
  process.exit(0)
}
const spr = Spr(Number(client)).load(readFixture(files.spr))
const start = performance.now()
const sheet = await buildSpriteSheet(spr, {
  deflate: deflateNode,
  trim: tool === 'backpack-trim'
})
const bytes = sheet.pages.reduce((sum, page) => sum + page.length, 0)
const pages = sheet.pages.length
const largest = Math.max(...sheet.json.meta.pages.flatMap((page) => [page.width, page.height]))
const ms = Math.round(performance.now() - start)
const peakMb = Math.round(process.resourceUsage().maxRSS / 1024)
console.log(
  JSON.stringify({
    tool,
    client,
    sprites: spr.count,
    ms,
    mb: +(bytes / 2 ** 20).toFixed(1),
    pages,
    largest,
    peakMb
  })
)
