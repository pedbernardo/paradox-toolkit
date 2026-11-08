import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { inflateSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { deflateNode, readDat, readOtb, readSpr, writeOutput } from './backpack-node.js'

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
})
