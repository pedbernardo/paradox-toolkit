/* oxlint-disable no-console */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { Spr } from './spr.js'

const FIXTURES_DIR = join(import.meta.dirname, '../fixtures')

function pad(s: string | number, n: number): string {
  return String(s).padStart(n)
}

const CW = { fixture: 30, size: 7, writeMs: 10, writeMbs: 7, streamMs: 11, streamMbs: 7 }

async function runOne(name: string): Promise<void> {
  const path = join(FIXTURES_DIR, name)
  const sizeMb = statSync(path).size / 1024 / 1024
  const buf = readFileSync(path)
  const arr = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)

  const file = Spr().load(arr)
  const spr = Spr(file.version)

  const t0 = Date.now()
  spr.write(file)
  const writeMs = Date.now() - t0

  const t1 = Date.now()
  for await (const _ of spr.writeStream(file)) {
    /* consume */
  }
  const streamMs = Date.now() - t1

  const writeMbs = (sizeMb / (writeMs / 1000)).toFixed(1)
  const streamMbs = (sizeMb / (streamMs / 1000)).toFixed(1)

  const row =
    `  ${name.padEnd(CW.fixture)} ${pad(sizeMb.toFixed(1) + 'MB', CW.size)}` +
    `  ${pad(fmt(writeMs) + 'ms', CW.writeMs)}  ${pad(writeMbs, CW.writeMbs)}` +
    `  ${pad(fmt(streamMs) + 'ms', CW.streamMs)}  ${pad(streamMbs, CW.streamMbs)}\n`
  process.stdout.write(row)
}

function fmt(n: number): string {
  return n.toLocaleString('en-US')
}

function discoverFixtures(): string[] {
  if (!existsSync(FIXTURES_DIR)) return []
  return readdirSync(FIXTURES_DIR)
    .filter((f) => f.endsWith('.spr'))
    .sort((a, b) => statSync(join(FIXTURES_DIR, a)).size - statSync(join(FIXTURES_DIR, b)).size)
}

async function main(): Promise<void> {
  const fixtures = discoverFixtures()

  if (fixtures.length === 0) {
    console.log('spr.bench: no fixtures found in packages/spr/fixtures/')
    return
  }

  const hr = (w: number) => '-'.repeat(w)
  console.log(`\nspr.bench — ${fixtures.length} fixture(s)\n`)
  console.log(
    `  ${'fixture'.padEnd(CW.fixture)} ${'size'.padStart(CW.size)}` +
      `  ${'write'.padStart(CW.writeMs)}  ${'MB/s'.padStart(CW.writeMbs)}` +
      `  ${'stream'.padStart(CW.streamMs)}  ${'MB/s'.padStart(CW.streamMbs)}`
  )
  console.log(
    `  ${hr(CW.fixture)} ${hr(CW.size)}  ${hr(CW.writeMs)}  ${hr(CW.writeMbs)}` +
      `  ${hr(CW.streamMs)}  ${hr(CW.streamMbs)}`
  )

  for (const name of fixtures) {
    await runOne(name)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
