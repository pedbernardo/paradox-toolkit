import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { inflateSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { syntheticDat, syntheticOtb, syntheticSpr } from '../tests/support/synthetic-client.js'
import { loadPack } from './backpack-load.js'
import {
  deflateNode,
  fsReader,
  readDat,
  readOtb,
  readSpr,
  writeOutput,
  writePack
} from './backpack-node.js'
import { buildPack } from './backpack-pack.js'

describe('backpack-node', () => {
  it('deflates with node:zlib', async () => {
    const data = Uint8Array.from({ length: 100 }, (_, i) => i % 7)
    expect(inflateSync(await deflateNode(data))).toEqual(Buffer.from(data))
  })

  it('names the missing file when an input does not exist', () => {
    expect(() => readDat('missing.dat', 772)).toThrow('DAT file not found: missing.dat')
    expect(() => readOtb('missing.otb')).toThrow('OTB file not found: missing.otb')
    expect(() => readSpr('missing.spr', 772)).toThrow('SPR file not found: missing.spr')
  })

  it('writes outputs, creating their directory', () => {
    const path = join(mkdtempSync(join(tmpdir(), 'backpack-')), 'a', 'b', 'out.json')
    writeOutput(path, '{}')
    expect(readFileSync(path, 'utf8')).toBe('{}')
  })

  it('writes a pack directory that loads back', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'backpack-pack-'))
    const files = await buildPack({
      dat: syntheticDat(),
      spr: syntheticSpr(),
      otb: syntheticOtb(),
      deflate: deflateNode
    })
    writePack(dir, files)
    expect(readFileSync(join(dir, 'page-0.png'))).toEqual(Buffer.from(files.pages[0]!))
    const pack = await loadPack(fsReader(dir))
    expect(pack.manifest).toEqual(files.manifest)
    expect(pack.items!.get(2004)!.name).toBe('gold coin')
    await expect(fsReader(dir)('missing.json')).rejects.toThrow('Asset pack file not found')
  })
})
