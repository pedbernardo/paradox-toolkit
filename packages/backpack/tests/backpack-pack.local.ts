import { describe, expect, it } from 'vitest'
import { Dat } from '@paradoxlab/dat'
import { fixtures, readFixture } from '@paradoxlab/fixtures'
import { Otb, inlineCountOf } from '@paradoxlab/otb'
import { Otbm } from '@paradoxlab/otbm'
import type { OtbmHeader } from '@paradoxlab/otbm'
import { Spr } from '@paradoxlab/spr'
import { checkCompatibility, loadPack } from '../src/backpack-load.js'
import { deflateNode } from '../src/backpack-node.js'
import { buildPack } from '../src/backpack-pack.js'
import type { AssetPack, AssetPackFiles } from '../src/types.js'

const CLIENTS = [
  ['772', 'otb1-3'],
  ['860', 'otb3-20'],
  ['870', 'otb3-23'],
  ['960', 'otb3-40'],
  ['1098', 'otb3-57']
] as const

const encoder = new TextEncoder()
const built = new Map<string, Promise<{ files: AssetPackFiles; pack: AssetPack }>>()

function packFor(client: string, items: string) {
  let entry = built.get(client)
  if (entry === undefined) {
    entry = (async () => {
      const clientFiles = fixtures().clientFixture(client)!
      const pack = await buildPack({
        dat: Dat(Number(client)).load(readFixture(clientFiles.dat)),
        spr: Spr(Number(client)).load(readFixture(clientFiles.spr)),
        otb: Otb().load(readFixture(fixtures().itemsFixture(items)!)),
        deflate: deflateNode
      })
      const json: Record<string, string> = {
        'pack.json': JSON.stringify(pack.manifest),
        'items.json': JSON.stringify(pack.items),
        'render.json': JSON.stringify(pack.render)
      }
      const loaded = await loadPack(async (path) => encoder.encode(json[path]!))
      return { files: pack, pack: loaded }
    })()
    built.set(client, entry)
  }
  return entry
}

const hasClient = (client: string, items: string) =>
  fixtures().clientFixture(client) !== undefined && fixtures().itemsFixture(items) !== undefined

describe('packs from real clients', () => {
  for (const [client, items] of CLIENTS) {
    it.skipIf(!hasClient(client, items))(
      `${client} with ${items}: consistent, every frame inside its page`,
      async () => {
        const { files, pack } = await packFor(client, items)
        const otb = Otb().load(readFixture(fixtures().itemsFixture(items)!))
        expect(files.items.sid).toEqual(otb.items.map((item) => item.sid))
        const frames = pack.frames!
        for (const id of files.render.appearances.frameIds) expect(id).toBeLessThan(frames.size)
        for (let f = 1; f < frames.size; f++) {
          const page = files.manifest.pages[frames.page[f]!]!
          expect(frames.x[f]! + frames.w[f]!).toBeLessThanOrEqual(page.width)
          expect(frames.y[f]! + frames.h[f]!).toBeLessThanOrEqual(page.height)
        }
        for (const page of files.manifest.pages) {
          expect(Math.max(page.width, page.height)).toBeLessThanOrEqual(4096)
        }
      },
      600_000
    )
  }

  it.skipIf(!hasClient('772', 'otb1-3'))(
    '772 has the 4,990 items of S4',
    async () => {
      expect((await packFor('772', 'otb1-3')).files.manifest.counts.items).toBe(4990)
    },
    600_000
  )
})

function mapOf(id: string): { header: OtbmHeader; sids: Set<number> } | undefined {
  const map = fixtures().mapFixture(id)
  if (map === undefined) return undefined
  const otb = map.itemsFile === undefined ? undefined : Otb().load(readFixture(map.itemsFile))
  const options = map.otbm === 1 && otb !== undefined ? { hasInlineCount: inlineCountOf(otb) } : {}
  let header: OtbmHeader | undefined
  const sids = new Set<number>()
  Otbm(options).read(readFixture(map.map), {
    header: (h) => (header = h),
    item: (sid) => sids.add(sid)
  })
  return { header: header!, sids }
}

describe('packs against real maps', () => {
  it.skipIf(
    !hasClient('772', 'otb1-3') ||
      fixtures().mapFixture('small-acceptance-otbm1-otb1-3') === undefined
  )(
    'every sid of the 7.72 acceptance map resolves to an appearance in the 772 pack',
    async () => {
      const { pack } = await packFor('772', 'otb1-3')
      const map = mapOf('small-acceptance-otbm1-otb1-3')!
      const missing = [...map.sids].filter((sid) => (pack.items!.appearanceOfSid[sid] ?? -1) < 0)
      expect(map.sids.size).toBeGreaterThan(500)
      expect(missing).toEqual([])
      expect(checkCompatibility(pack.manifest, map.header).level).toBe('ok')
    },
    600_000
  )

  it.skipIf(
    !hasClient('772', 'otb1-3') ||
      fixtures().mapFixture('large-small-areas-otbm3-otb3-20') === undefined
  )(
    'an 8.60 map is refused by the 772 pack',
    async () => {
      const { pack } = await packFor('772', 'otb1-3')
      const map = mapOf('large-small-areas-otbm3-otb3-20')!
      expect(checkCompatibility(pack.manifest, map.header).level).toBe('error')
    },
    600_000
  )

  it.skipIf(
    !hasClient('870', 'otb3-23') ||
      fixtures().mapFixture('small-distro-xml-otbm2-otb3-10') === undefined
  )(
    'a map saved with an older OTB of the same lineage warns with the 870 pack',
    async () => {
      const { pack } = await packFor('870', 'otb3-23')
      const map = mapOf('small-distro-xml-otbm2-otb3-10')!
      expect(checkCompatibility(pack.manifest, map.header).level).toBe('warn')
    },
    600_000
  )
})
