import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { deflateSync } from 'node:zlib'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { syntheticDat, syntheticOtb, syntheticSpr } from '../tests/support/synthetic-client.js'
import { ItemFlag } from './backpack-flags.js'
import { checkCompatibility, loadPack, urlReader } from './backpack-load.js'
import { buildPack } from './backpack-pack.js'
import type { AssetPackFiles, PackManifest, PackReader } from './types.js'

const deflate = (data: Uint8Array) => deflateSync(data)
const encoder = new TextEncoder()

function memoryReader(pack: AssetPackFiles, reads: string[] = []): PackReader {
  const files: Record<string, string> = {
    'pack.json': JSON.stringify(pack.manifest),
    'items.json': JSON.stringify(pack.items),
    'render.json': JSON.stringify(pack.render)
  }
  return async (path) => {
    reads.push(path)
    if (!(path in files)) throw new Error(`no ${path}`)
    return encoder.encode(files[path])
  }
}

const built = buildPack({ dat: syntheticDat(), spr: syntheticSpr(), otb: syntheticOtb(), deflate })

describe('loadPack', () => {
  it('loads items and render data into typed arrays with views by sid', async () => {
    const pack = await loadPack(memoryReader(await built))
    expect(pack.items!.columns.sid).toBeInstanceOf(Int32Array)
    expect(pack.frames!.x).toBeInstanceOf(Uint16Array)
    const coin = pack.items!.get(2004)!
    expect(coin.name).toBe('gold coin')
    expect(coin.has(ItemFlag.Stackable)).toBe(true)
    const look = coin.appearance!
    expect(look.layout).toEqual({
      width: 1,
      height: 1,
      patternX: 4,
      patternY: 2,
      patternZ: 1,
      frames: 1
    })
    expect(look.frameCount).toBe(8)
    expect(look.frame(0)).toBe(look.frame(7))
    expect(look.frame(8)).toBeUndefined()
    expect(pack.items!.get(2003)!.appearance!.offset).toEqual({ x: 8, y: 8 })
    expect(pack.items!.get(2000)!.appearance!.opaque).toBe(true)
    expect(pack.items!.get(2007)!.appearance).toBeNull()
    expect(pack.items!.get(1)).toBeUndefined()
    expect(pack.items!.get(99_999)).toBeUndefined()
    expect([...pack.items!].length).toBe(8)
  })

  it('derives the appearance of every sid', async () => {
    const { items } = await loadPack(memoryReader(await built))
    expect(items!.appearanceOfSid[2006]).toBe(items!.appearanceOfSid[2004])
    expect(items!.appearanceOfSid[2007]).toBe(-1)
    expect(items!.appearanceOfSid[5]).toBe(-1)
  })

  it('reads only what is asked: a server needs no render data', async () => {
    const reads: string[] = []
    const pack = await loadPack(memoryReader(await built, reads), { parts: ['items'] })
    expect(reads).toEqual(['pack.json', 'items.json'])
    expect(pack.frames).toBeNull()
    expect(pack.appearances).toBeNull()
    expect(pack.items!.get(2004)!.appearance).toBeNull()
  })

  it('lets the caller refuse the pack from its manifest before reading anything else', async () => {
    const reads: string[] = []
    const refuse = (manifest: PackManifest) => {
      throw new Error(`no ${manifest.client}`)
    }
    await expect(loadPack(memoryReader(await built, reads), { check: refuse })).rejects.toThrow(
      'no 860'
    )
    expect(reads).toEqual(['pack.json'])
  })

  it('refuses another major schema', async () => {
    const pack = await built
    const reader = memoryReader({ ...pack, manifest: { ...pack.manifest, schema: '2.0.0' } })
    await expect(loadPack(reader)).rejects.toThrow('schema 2.0.0')
  })

  it('gets appearances by row', async () => {
    const { appearances } = await loadPack(memoryReader(await built))
    expect(appearances!.size).toBe(6)
    expect(appearances!.get(1)!.cid).toBe(101)
    expect(appearances!.get(6)).toBeUndefined()
  })
})

describe('urlReader', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('fetches files under the pack URL and fails on HTTP errors', async () => {
    const fetch = vi.fn(async (url: URL) =>
      url.pathname.endsWith('pack.json') ? new Response('{}') : new Response('', { status: 404 })
    )
    vi.stubGlobal('fetch', fetch)
    const read = urlReader('https://cdn.example/packs/860')
    expect(new TextDecoder().decode(await read('pack.json'))).toBe('{}')
    expect(String(fetch.mock.calls[0]![0])).toBe('https://cdn.example/packs/860/pack.json')
    await expect(read('page-0.png')).rejects.toThrow('HTTP 404')
  })
})

describe('checkCompatibility', () => {
  const manifest = (lineage: PackManifest['lineage']) => ({ lineage }) as PackManifest

  it('is ok on the same OTB, warns on an older minor, refuses a newer minor or another lineage', () => {
    expect(
      checkCompatibility(manifest({ otbMajor: 1, otbMinor: 3 }), { otbMajor: 1, otbMinor: 3 }).level
    ).toBe('ok')
    expect(
      checkCompatibility(manifest({ otbMajor: 3, otbMinor: 23 }), { otbMajor: 3, otbMinor: 10 })
        .level
    ).toBe('warn')
    expect(
      checkCompatibility(manifest({ otbMajor: 3, otbMinor: 20 }), { otbMajor: 3, otbMinor: 23 })
        .level
    ).toBe('error')
    expect(
      checkCompatibility(manifest({ otbMajor: 1, otbMinor: 3 }), { otbMajor: 3, otbMinor: 20 })
        .level
    ).toBe('error')
  })

  it('warns for a pack built without an OTB', () => {
    expect(checkCompatibility(manifest(null), { otbMajor: 3, otbMinor: 20 }).level).toBe('warn')
  })
})

describe('the /load entry', () => {
  it('imports no Node module and no other package', () => {
    const seen = new Set<string>()
    const visit = (file: string) => {
      if (seen.has(file)) return
      seen.add(file)
      const source = readFileSync(file, 'utf8')
      for (const [, kind, from] of source.matchAll(
        /^(import|export)(?! type)[^'"]*from '([^']+)'/gm
      )) {
        void kind
        expect(from, `${file} imports ${from}`).toMatch(/^\.\//)
        visit(join(dirname(file), from!.replace(/\.js$/, '.ts')))
      }
    }
    visit(join(import.meta.dirname, 'load.ts'))
    expect(seen.size).toBeGreaterThan(2)
    // The content builder carries the name map; a page that only loads packs must not pull it in.
    expect([...seen].some((file) => file.endsWith('backpack-content.ts'))).toBe(false)
  })

  it('exposes the constants that read a loaded pack', async () => {
    const load = await import('./load.js')
    const content = await import('./content.js')
    expect(load.ItemFlag).toBe(content.ItemFlag)
    expect(load.FloorChange).toBe(content.FloorChange)
    expect(load.StackOrder).toBe(content.StackOrder)
    expect(load.AppearanceFlag).toBe(content.AppearanceFlag)
  })
})
