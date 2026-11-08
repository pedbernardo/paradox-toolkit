/* oxlint-disable no-console */
// Runs every measurement in its own process, so one map's heap never skews another's numbers.
// Usage: pnpm --filter @paradoxlab/otbm bench [--ops=read,copy] [fixture-id ...]
import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { cpus, totalmem } from 'node:os'
import { join } from 'node:path'

const DEFAULT_IDS = [
  'medium-reference-otbm2-otb3-15',
  'large-small-areas-otbm3-otb3-20',
  'xlarge-stress-otbm2-otb3-15',
  'xlarge-stress-alt-otbm2-otb3-23'
]
const DEFAULT_OPERATIONS = ['read', 'read-layout', 'copy', 'compose', 'load', 'write-document']

const args = process.argv.slice(2)
const opsArg = args.find((arg) => arg.startsWith('--ops='))
const operations =
  opsArg === undefined ? DEFAULT_OPERATIONS : opsArg.slice('--ops='.length).split(',')
const ids = args.filter((arg) => !arg.startsWith('--'))
const targets = ids.length > 0 ? ids : DEFAULT_IDS

type Result = {
  id: string
  operation: string
  mb: number
  ms: number
  extraMb: number
  skipped?: boolean
}
const results: Result[] = []
for (const id of targets) {
  for (const operation of operations) {
    const out = execFileSync(
      process.execPath,
      [
        '--expose-gc',
        '--max-old-space-size=8192',
        '--import',
        'tsx/esm',
        join(import.meta.dirname, 'measure.ts'),
        operation,
        id
      ],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }
    )
    const result = JSON.parse(out.trim().split('\n').at(-1)!) as Result
    results.push(result)
    console.log(JSON.stringify(result))
  }
}

const cell = (id: string, operation: string): string => {
  const r = results.find((x) => x.id === id && x.operation === operation)
  if (r === undefined || r.skipped) return '-'
  const memory = ['copy', 'load', 'compose'].includes(operation) ? ` · ${r.extraMb} MB` : ''
  return `${r.ms.toLocaleString('en-US')} ms${memory}`
}
const header = `| Fixture | MB | ${operations.join(' | ')} |`
const rows = targets.map((id) => {
  const mb = results.find((x) => x.id === id && !x.skipped)?.mb ?? 0
  return `| ${id} | ${mb.toFixed(1)} | ${operations.map((op) => cell(id, op)).join(' | ')} |`
})
const table = [header, `|---|---|${operations.map(() => '---|').join('')}`, ...rows].join('\n')
const machine = `${cpus()[0]?.model.trim()}, ${Math.round(totalmem() / 2 ** 30)} GB, Node ${process.version}`
writeFileSync(
  join(import.meta.dirname, '../results/perf-latest.md'),
  `# @paradoxlab/otbm benchmark\n\n${new Date().toISOString().slice(0, 10)} · ${machine} · best of 5, one process per cell\n\n${table}\n`
)
console.log(`\n${table}`)
