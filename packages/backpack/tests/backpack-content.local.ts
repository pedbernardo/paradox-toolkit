import { describe, expect, it } from 'vitest'
import { Dat } from '@paradoxlab/dat'
import { fixtures, readFixture } from '@paradoxlab/fixtures'
import { Otb } from '@paradoxlab/otb'
import { buildContent } from '../src/backpack-content.js'

const CLIENTS = [
  ['772', 'otb1-3'],
  ['860', 'otb3-20'],
  ['870', 'otb3-23'],
  ['960', 'otb3-40'],
  ['1098', 'otb3-57']
] as const

describe('content from real clients: no sid lost or made up', () => {
  for (const [client, items] of CLIENTS) {
    const files = fixtures().clientFixture(client)
    const otbFile = fixtures().itemsFixture(items)
    it.skipIf(files === undefined || otbFile === undefined)(`${client} with ${items}`, () => {
      const dat = Dat(Number(client)).load(readFixture(files!.dat))
      const otb = Otb().load(readFixture(otbFile!))
      const content = buildContent({ dat, otb })
      expect(content.items.sid).toEqual(otb.items.map((item) => item.sid))
      const itemThings = [...dat.entries()].filter((t) => t.group === 'items')
      expect(content.appearances.cid.length).toBe(itemThings.length)
    })
  }
})
