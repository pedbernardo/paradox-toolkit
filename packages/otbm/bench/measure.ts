/* oxlint-disable no-console */
// One measurement in a fresh process: `node bench/measure.ts <operation> <fixture-id> [runs]`.
// Prints one JSON line: best time in ms and, for load, the retained heap.
import { fixtures } from '@paradoxlab/fixtures'
import { Otbm } from '../src/otbm.js'
import { collectDocument } from '../src/otbm-document.js'
import { collectSourceLayout, composeOtbm } from '../src/otbm-layout.js'
import type {
  OtbmDocument,
  OtbmDocumentNode,
  OtbmDocumentTile,
  OtbmTileSource,
  OtbmVisitor
} from '../src/types.js'
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
/**
 * A tile source as the editor keeps its map: 32x32 chunks, with keys that stay small integers
 * (chunk x and y in 11 bits each, floor in 4), so V8 never boxes them.
 */
function tileSourceOf(document: OtbmDocument): OtbmTileSource {
  const chunks = new Map<number, Map<number, OtbmDocumentTile>>()
  const chunkKey = (x: number, y: number, z: number) => (x >> 5) | ((y >> 5) << 11) | (z << 22)
  const cellKey = (x: number, y: number) => ((y & 31) << 5) | (x & 31)
  const find = (x: number, y: number, z: number) =>
    chunks.get(chunkKey(x, y, z))?.get(cellKey(x, y))
  for (const group of [document.beforeMapData, document.entries, document.afterMapData]) {
    for (const entry of group) {
      if (entry.kind !== 'area') continue
      for (const tile of entry.tiles) {
        if (tile.kind !== 'tile') continue
        const key = chunkKey(tile.x, tile.y, tile.z)
        let chunk = chunks.get(key)
        if (chunk === undefined) chunks.set(key, (chunk = new Map()))
        chunk.set(cellKey(tile.x, tile.y), tile)
      }
    }
  }
  const emitNodes = (nodes: readonly OtbmDocumentNode[], visitor: OtbmVisitor): void => {
    for (const node of nodes) {
      if (node.kind === 'unknown') {
        visitor.unknownNode?.(node.type, node.raw)
        continue
      }
      visitor.item?.(node.sid, node.form, node.attributes)
      if (node.children !== null) emitNodes(node.children, visitor)
      visitor.itemEnd?.()
    }
  }
  return {
    hasTile: (x, y, z) => find(x, y, z) !== undefined,
    emitTile(x, y, z, visitor) {
      const tile = find(x, y, z)
      if (tile === undefined) return false
      visitor.tile?.(tile.x, tile.y, tile.z, tile.flags, tile.houseId, tile.tail)
      emitNodes(tile.items, visitor)
      visitor.tileEnd?.()
      return true
    },
    forEachTile(fn) {
      for (const chunk of chunks.values())
        for (const tile of chunk.values()) fn(tile.x, tile.y, tile.z)
    }
  }
}

let composeOf: (() => ReturnType<typeof composeOtbm>) | undefined

const gc = (globalThis as { gc?: () => void }).gc ?? (() => {})

// ArrayBuffer memory is released after the collection that frees it, so let it settle before reading.
const settle = async (): Promise<void> => {
  gc()
  await new Promise((resolve) => setTimeout(resolve, 0))
  gc()
}

// Each operation is built only when asked for, so no other data sits in the heap while it runs.
const operations: Record<string, () => () => unknown> = {
  read: () => () => otbm.read(bytes, {}),
  copy: () => () => {
    let total = 0
    for (const chunk of otbm.writeStream(otbm.source(bytes))) total += chunk.length
    if (total !== bytes.length) throw new Error(`copy wrote ${total} of ${bytes.length} bytes`)
  },
  load: () => () => otbm.load(bytes),
  // What an editor does on open: read once, collecting the Source layout next to its own model.
  'read-layout': () => () => {
    const layout = collectSourceLayout()
    otbm.read(bytes, layout.visitor)
    return layout.layout()
  },
  // What an editor does on save: compose its tiles in the Source layout and stream the bytes.
  compose: () => {
    const layout = collectSourceLayout()
    const document = collectDocument()
    otbm.read(bytes, [layout.visitor, document.visitor])
    const source = layout.layout()
    const tiles = tileSourceOf(document.document())
    composeOf = () => composeOtbm(source, tiles)
    return () => {
      let total = 0
      for (const chunk of otbm.writeStream(composeOtbm(source, tiles))) total += chunk.length
      if (total !== bytes.length) throw new Error(`compose wrote ${total} of ${bytes.length} bytes`)
    }
  },
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
  await settle()
  const baseline = process.memoryUsage().arrayBuffers
  for (const chunk of otbm.writeStream(otbm.source(bytes))) {
    void chunk
    await settle()
    extraMb = Math.max(extraMb, (process.memoryUsage().arrayBuffers - baseline) / 2 ** 20)
  }
}
// Memory of a compose: what it adds to the model already in memory (writer buffer, the chunk in
// hand, the composer's per-area bitmaps), heap and ArrayBuffers, sampled after a collection every
// 8 chunks (a collection per chunk takes minutes with a whole map in the heap).
if (operation === 'compose' && composeOf !== undefined) {
  const memory = () => process.memoryUsage().heapUsed + process.memoryUsage().arrayBuffers
  await settle()
  const baseline = memory()
  let index = 0
  for (const chunk of otbm.writeStream(composeOf())) {
    void chunk
    if (index++ % 8 !== 0) continue
    await settle()
    extraMb = Math.max(extraMb, (memory() - baseline) / 2 ** 20)
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
