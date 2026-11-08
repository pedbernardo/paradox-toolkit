/* oxlint-disable no-console */
// One measurement in a fresh process: `node bench/measure.ts <operation> <fixture-id> [runs]`.
// Prints one JSON line: best time in ms and, for load, the retained heap.
import { fixtures } from '@paradoxlab/fixtures'
import { Otbm } from '../src/otbm.js'
import { loadMap } from '../tests/support/otbm-fixtures.js'

const [operation, id, runsArg] = process.argv.slice(2)
const runs = Number(runsArg ?? 5)
const map = fixtures().mapFixture(id!)
if (map === undefined) {
  console.log(JSON.stringify({ id, operation, skipped: true }))
  process.exit(0)
}
const { bytes, options } = loadMap(map)
const otbm = Otbm(options)
const gc = (globalThis as { gc?: () => void }).gc ?? (() => {})

// Each operation is built only when asked for, so no other data sits in the heap while it runs.
const operations: Record<string, () => () => unknown> = {
  read: () => () => otbm.read(bytes, {}),
  copy: () => () => {
    let total = 0
    for (const chunk of otbm.writeStream(otbm.source(bytes))) total += chunk.length
    if (total !== bytes.length) throw new Error(`copy wrote ${total} of ${bytes.length} bytes`)
  },
  load: () => () => otbm.load(bytes),
  'write-document': () => {
    const document = otbm.load(bytes)
    return () => otbm.write(document)
  }
}
const build = operations[operation!]
if (build === undefined) throw new Error(`unknown operation ${operation}`)
const run = build()

let best = Number.POSITIVE_INFINITY
let extraMb = 0
let retained: unknown
for (let i = 0; i < runs; i++) {
  retained = undefined
  gc()
  const heap = process.memoryUsage().heapUsed
  const start = performance.now()
  retained = run()
  best = Math.min(best, performance.now() - start)
  if (operation === 'load') {
    gc()
    extraMb = Math.max(extraMb, (process.memoryUsage().heapUsed - heap) / 2 ** 20)
  }
}
void retained

// Memory of a copy, apart from timing: what the writer holds (its buffer and the chunk in hand),
// sampled after a collection at every chunk so dropped chunks do not count.
if (operation === 'copy') {
  gc()
  const baseline = process.memoryUsage().arrayBuffers
  for (const chunk of otbm.writeStream(otbm.source(bytes))) {
    void chunk
    gc()
    extraMb = Math.max(extraMb, (process.memoryUsage().arrayBuffers - baseline) / 2 ** 20)
  }
}
console.log(
  JSON.stringify({
    id,
    operation,
    mb: bytes.length / 2 ** 20,
    ms: Math.round(best),
    extraMb: Math.round(extraMb * 10) / 10
  })
)
