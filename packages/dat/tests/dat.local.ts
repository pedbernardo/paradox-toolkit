import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeAll, describe, expect, it } from 'vitest'
import { ParseError, UnsupportedVersionError } from '@paradoxlab/utils'
import type { DatFile, DatWriteInput } from '../src/types.js'
import { Dat } from '../src/dat.js'

const dirname = fileURLToPath(new URL('.', import.meta.url))
const fixture = (name: string) => join(dirname, '..', 'fixtures', name)

function readFixture(version: number): ArrayBuffer {
  const buf = readFileSync(fixture(`dat-${version}.dat`))
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer
}

function loadDat(version: number): DatFile {
  return Dat(version).load(readFixture(version))
}

// signature validation

describe('signature validation', () => {
  it('validate() throws ParseError when buffer version does not match', () => {
    expect(() => Dat(710).validate(readFixture(772))).toThrow(ParseError)
  })

  it('constructor throws UnsupportedVersionError for unsupported version', () => {
    expect(() => Dat(999)).toThrow(UnsupportedVersionError)
  })
})

// dat-772 concrete values

describe('dat-772', () => {
  let file: DatFile

  beforeAll(() => {
    file = loadDat(772)
  })

  it('has correct signature', () => {
    expect(file.signature).toBe(0x439d5a33)
  })

  it('has expected itemsMaxCid', () => {
    expect(file.counts.itemsMaxCid).toBe(5089)
  })

  it('has expected creature count', () => {
    expect(file.counts.creatures).toBe(254)
  })

  it('has expected effect count', () => {
    expect(file.counts.effects).toBe(25)
  })

  it('has expected missile count', () => {
    expect(file.counts.missiles).toBe(15)
  })

  it('item 100 is in group items', () => {
    expect(file.get('items', 100)?.group).toBe('items')
  })

  it('item 100 has 1x1 layout', () => {
    const layout = file.get('items', 100)?.layout
    expect(layout?.width).toBe(1)
    expect(layout?.height).toBe(1)
  })

  it('item 100 has ground flag', () => {
    expect(file.get('items', 100)?.flags.ground).toBeDefined()
  })

  it('first creature (1) is in group creatures', () => {
    expect(file.get('creatures', 1)?.group).toBe('creatures')
  })

  it('creature layout has valid dimensions', () => {
    const layout = file.get('creatures', 1)?.layout
    expect(layout).toBeDefined()
    expect(layout!.patternX).toBeGreaterThanOrEqual(1)
    expect(layout!.width).toBeGreaterThanOrEqual(1)
  })

  it('effect (1) is in group effects', () => {
    expect(file.get('effects', 1)?.group).toBe('effects')
  })

  it('missile (1) is in group missiles', () => {
    expect(file.get('missiles', 1)?.group).toBe('missiles')
  })

  it('spriteIds count matches layout dimensions', () => {
    const thing = file.get('creatures', 1)!
    const { width, height, layers, patternX, patternY, patternZ, frames } = thing.layout
    expect(thing.spriteIds.length).toBe(
      width * height * layers * patternX * patternY * patternZ * frames
    )
  })

  it('entries() iterates all parsed things', () => {
    let count = 0
    for (const thing of file.entries()) {
      expect(thing.cid).toBeGreaterThan(0)
      count++
    }
    expect(count).toBeGreaterThan(0)
  })
})

// dat-710: patternZ=false branch (version < 755)

describe('dat-710', () => {
  let file: DatFile

  beforeAll(() => {
    file = loadDat(710)
  })

  it('loads without throwing', () => {
    expect(() => loadDat(710)).not.toThrow()
  })

  it('item 100 is in group items', () => {
    expect(file.get('items', 100)?.group).toBe('items')
  })
})

// dat-960: extendedSprites=true branch

describe('dat-960', () => {
  let file: DatFile

  beforeAll(() => {
    file = loadDat(960)
  })

  it('loads without throwing', () => {
    expect(() => loadDat(960)).not.toThrow()
  })

  it('itemsMaxCid is greater than 5000', () => {
    expect(file.counts.itemsMaxCid).toBeGreaterThan(5000)
  })

  it('item 100 is in group items', () => {
    expect(file.get('items', 100)?.group).toBe('items')
  })

  it('entries() yields all things', () => {
    let count = 0
    for (const thing of file.entries()) {
      expect(thing.cid).toBeGreaterThan(0)
      count++
    }
    expect(count).toBeGreaterThan(0)
  })
})

// dat-1098: frameDurations + frameGroups branches (version >= 1030/1090)

describe('dat-1098', () => {
  let file: DatFile

  beforeAll(() => {
    file = loadDat(1098)
  })

  it('loads without throwing', () => {
    expect(() => loadDat(1098)).not.toThrow()
  })

  it('itemsMaxCid is greater than 5000', () => {
    expect(file.counts.itemsMaxCid).toBeGreaterThan(5000)
  })

  it('item 100 is in group items', () => {
    expect(file.get('items', 100)?.group).toBe('items')
  })

  it('entries() yields all things', () => {
    let count = 0
    for (const thing of file.entries()) {
      expect(thing.cid).toBeGreaterThan(0)
      count++
    }
    expect(count).toBeGreaterThan(0)
  })
})

// things array - all fixture versions

describe('things array - all fixture versions', () => {
  const FIXTURE_VERSIONS = [710, 740, 760, 772, 860, 870, 960, 980, 1098]

  for (const version of FIXTURE_VERSIONS) {
    it(`dat-${version}: things is non-empty`, () => {
      const file = loadDat(version)
      expect(file.things.length).toBeGreaterThan(0)
    })

    it(`dat-${version}: things and get() return the same objects`, () => {
      const file = loadDat(version)
      for (const thing of file.things) {
        expect(file.get(thing.group, thing.cid)).toBe(thing)
      }
    })
  }

  it('dat-1098: at least one item has layout.animation defined', () => {
    const file = loadDat(1098)
    const hasAnimation = file.things.some((t) => t.layout.animation !== undefined)
    expect(hasAnimation).toBe(true)
  })
})

// write() round-trip

describe('write() round-trip - all versions', () => {
  const LOSSLESS_VERSIONS = [710, 740, 760, 772, 860, 870, 960, 980, 1098]

  for (const version of LOSSLESS_VERSIONS) {
    describe(`dat-${version}`, () => {
      let file: DatFile
      let reparsed: DatFile

      beforeAll(() => {
        file = loadDat(version)
        reparsed = Dat(version).load(Dat(version).write(file as DatWriteInput))
      })

      it('reparsed itemsMaxCid matches original', () => {
        expect(reparsed.counts.itemsMaxCid).toBe(file.counts.itemsMaxCid)
      })

      it('reparsed creature count matches original', () => {
        expect(reparsed.counts.creatures).toBe(file.counts.creatures)
      })

      it('reparsed things length matches original', () => {
        expect(reparsed.things.length).toBe(file.things.length)
      })

      it('sample things survive round-trip: flags deep-equal', () => {
        for (const thing of [file.get('items', 100), file.get('creatures', 1)]) {
          if (!thing) continue
          const rt = reparsed.get(thing.group, thing.cid)
          expect(rt).toBeDefined()
          expect(rt!.flags).toEqual(thing.flags)
        }
      })

      it('sample things survive round-trip: spriteIds deep-equal', () => {
        for (const thing of [file.get('items', 100), file.get('creatures', 1)]) {
          if (!thing) continue
          const rt = reparsed.get(thing.group, thing.cid)
          expect(rt!.spriteIds).toEqual(thing.spriteIds)
        }
      })
    })
  }
})

describe('write() animation round-trip (dat-1098)', () => {
  it('animated item survives round-trip', () => {
    const file = loadDat(1098)
    const animatedItem = file.things.find(
      (t) => t.group === 'items' && t.layout.animation !== undefined
    )!
    expect(animatedItem).toBeDefined()
    const reparsed = Dat(1098).load(Dat(1098).write(file as DatWriteInput))
    const rt = reparsed.get(animatedItem.group, animatedItem.cid)!
    expect(rt.layout.animation).toEqual(animatedItem.layout.animation)
  })
})
