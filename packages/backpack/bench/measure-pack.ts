/* oxlint-disable no-console */
// One Asset Pack measurement in a fresh process: `node bench/measure-pack.ts <build|load> <client> [padding]`.
// `build` writes the pack under the OS temp directory, where `load` reads it back.
import { readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Dat } from '@paradoxlab/dat'
import { fixtures, readFixture } from '@paradoxlab/fixtures'
import { Otb } from '@paradoxlab/otb'
import { Spr } from '@paradoxlab/spr'
import { loadPack } from '../src/backpack-load.js'
import { deflateNode, writePack } from '../src/backpack-node.js'
import { buildPack } from '../src/backpack-pack.js'

const ITEMS: Record<string, string> = {
  '772': 'otb1-3',
  '860': 'otb3-20',
  '870': 'otb3-23',
  '960': 'otb3-40',
  '1098': 'otb3-57'
}

const [operation, client, paddingArg] = process.argv.slice(2) as [string, string, string?]
const padding = paddingArg === undefined ? undefined : Number(paddingArg)
const files = fixtures().clientFixture(client)
const items = fixtures().itemsFixture(ITEMS[client] ?? '')
if (files === undefined || items === undefined) {
  console.log(JSON.stringify({ operation, client, skipped: true }))
  process.exit(0)
}
if (operation === 'check') {
  console.log(JSON.stringify({ operation, client }))
  process.exit(0)
}
const dir = join(tmpdir(), 'backpack-bench', `${client}-${padding ?? 'default'}`)
const mb = (bytes: number) => +(bytes / 2 ** 20).toFixed(2)

if (operation === 'build') {
  const dat = Dat(Number(client)).load(readFixture(files.dat))
  const spr = Spr(Number(client)).load(readFixture(files.spr))
  const otb = Otb().load(readFixture(items))
  const start = performance.now()
  const pack = await buildPack({
    dat,
    spr,
    otb,
    deflate: deflateNode,
    ...(padding === undefined ? {} : { padding })
  })
  const ms = Math.round(performance.now() - start)
  writePack(dir, pack)
  const size = (name: string) => readFileSync(join(dir, name)).length
  const pagesBytes = pack.manifest.pages.reduce((sum, page) => sum + size(page.file), 0)
  const pixels = pack.manifest.pages.reduce((sum, page) => sum + page.width * page.height, 0)
  console.log(
    JSON.stringify({
      operation,
      client,
      ms,
      ...pack.manifest.counts,
      pages: pack.pages.length,
      mpx: +(pixels / 1e6).toFixed(1),
      pagesMb: mb(pagesBytes),
      itemsMb: mb(size('items.json')),
      renderMb: mb(size('render.json')),
      totalMb: mb(pagesBytes + size('items.json') + size('render.json') + size('pack.json')),
      peakMb: Math.round(process.resourceUsage().maxRSS / 1024)
    })
  )
} else {
  // Files read once into memory, so the time is parsing and typed arrays, not the disk.
  const bytes = new Map(
    ['pack.json', 'items.json', 'render.json'].map((name) => [name, readFileSync(join(dir, name))])
  )
  const read = async (path: string) => bytes.get(path)!
  // Typed arrays live in ArrayBuffers, outside the JS heap: count both.
  const memory = () => process.memoryUsage().heapUsed + process.memoryUsage().arrayBuffers
  const gc = (globalThis as { gc?: () => void }).gc ?? (() => {})
  let best = Number.POSITIVE_INFINITY
  let heapMb = 0
  let pack: unknown
  for (let run = 0; run < 5; run++) {
    pack = undefined
    gc()
    const heap = memory()
    const start = performance.now()
    pack = await loadPack(read)
    best = Math.min(best, performance.now() - start)
    gc()
    heapMb = Math.max(heapMb, (memory() - heap) / 2 ** 20)
  }
  void pack
  console.log(
    JSON.stringify({ operation, client, ms: +best.toFixed(1), heapMb: +heapMb.toFixed(1) })
  )
}
