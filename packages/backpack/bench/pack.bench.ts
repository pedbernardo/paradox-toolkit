/* oxlint-disable no-console */
// Asset Packs: build and load per client, one process per measurement, best of 3 processes (the
// machine throttles under sustained load, so a single run can be off by 2x).
// Usage: pnpm --filter @paradoxlab/backpack bench:pack [client ...]
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'

const clients =
  process.argv.slice(2).length > 0 ? process.argv.slice(2) : ['772', '860', '870', '960', '1098']
const measure = (operation: string, client: string) => {
  const out = execFileSync(
    process.execPath,
    [
      '--expose-gc',
      '--max-old-space-size=8192',
      '--import',
      'tsx/esm',
      join(import.meta.dirname, 'measure-pack.ts'),
      operation,
      client
    ],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }
  )
  const result = JSON.parse(out.trim().split('\n').at(-1)!)
  console.log(JSON.stringify(result))
  return result
}
const best = (operation: string, client: string) => {
  const runs = [0, 1, 2].map(() => measure(operation, client))
  return runs.reduce((a, b) => (b.ms < a.ms ? b : a))
}
const rows: string[] = []
for (const client of clients) {
  if (measure('check', client).skipped) continue
  const b = best('build', client)
  const l = best('load', client)
  rows.push(
    `| ${client} | ${b.items.toLocaleString('en-US')} | ${b.appearances.toLocaleString('en-US')} | ${b.frames.toLocaleString('en-US')} | ${b.pages} · ${b.mpx} Mpx | ${b.pagesMb} + ${b.itemsMb} + ${b.renderMb} = ${b.totalMb} MB | ${b.ms.toLocaleString('en-US')} ms · ${b.peakMb} MB | ${l.ms} ms · ${l.heapMb} MB |`
  )
}
console.log(
  [
    '',
    '| Client | Items | Appearances | Frames | Pages | Pages + items + render | Build · peak memory | Load · heap |',
    '|---|---|---|---|---|---|---|---|',
    ...rows
  ].join('\n')
)
