/* oxlint-disable no-console */
// Sprite sheets: backpack untrimmed and trimmed, one process per cell.
// Usage: pnpm --filter @paradoxlab/backpack bench:sprites [client ...]
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'

const clients =
  process.argv.slice(2).length > 0 ? process.argv.slice(2) : ['772', '860', '960', '1098']
const tools = ['backpack', 'backpack-trim']
const rows: string[] = []
for (const client of clients) {
  for (const tool of tools) {
    const out = execFileSync(
      process.execPath,
      [
        '--max-old-space-size=8192',
        '--import',
        'tsx/esm',
        join(import.meta.dirname, 'measure-sprites.ts'),
        tool,
        client
      ],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }
    )
    const r = JSON.parse(out.trim().split('\n').at(-1)!)
    console.log(JSON.stringify(r))
    if (!r.skipped) {
      rows.push(
        `| ${client} | ${r.sprites} | ${tool} | ${r.ms.toLocaleString('en-US')} ms | ${r.mb} MB | ${r.pages} | ${r.largest} px | ${r.peakMb} MB |`
      )
    }
  }
}
console.log(
  [
    '',
    '| Client | Sprites | Tool | Time | PNG total | Pages | Largest side | Peak memory |',
    '|---|---|---|---|---|---|---|---|',
    ...rows
  ].join('\n')
)
