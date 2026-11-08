import { describe, expect, it } from 'vitest'
import { UnencodableTextError } from '@paradoxlab/utils'
import { Otb } from './otb.js'
import { ITEM_GROUP } from './otb-config.js'
import type { OtbItem, OtbItemFlags } from './types.js'

const NO_FLAGS: OtbItemFlags = {
  unpassable: false,
  blockMissiles: false,
  blockPathfinder: false,
  hasElevation: false,
  useable: false,
  pickupable: false,
  moveable: false,
  stackable: false,
  floorChangeDown: false,
  floorChangeNorth: false,
  floorChangeEast: false,
  floorChangeSouth: false,
  floorChangeWest: false,
  alwaysOnTop: false,
  readable: false,
  rotable: false,
  hangable: false,
  hookEast: false,
  hookSouth: false,
  cannotDecay: false,
  allowDistRead: false,
  clientDuration: false,
  clientCharges: false,
  ignoreLook: false,
  isAnimation: false,
  fullGround: false,
  forceUse: false
}

function named(name: string, description?: string): OtbItem {
  return {
    sid: 100,
    cid: 0,
    group: ITEM_GROUP.GROUND,
    flags: NO_FLAGS,
    attributes: description === undefined ? { name } : { name, description }
  }
}

const SCHEMA = '3.57.0'

describe('item name and description strings', () => {
  it('round-trips windows-1252 text by default, including 0x80-0x9F characters', () => {
    const otb = Otb()
    const bytes = otb.write({
      schemaVersion: SCHEMA,
      items: [named('Gold Coin’s ã', 'costs €5 …')]
    })
    const back = otb.load(bytes).get(100)
    expect(back?.attributes.name).toBe('Gold Coin’s ã')
    expect(back?.attributes.description).toBe('costs €5 …')
  })

  it('writes one escaped byte per windows-1252 character after the escaped length', () => {
    const bytes = Otb().write({ schemaVersion: SCHEMA, items: [named('ÿ')] })
    // NAME (18), length 1 as escaped u16, then 0xff escaped as 0xfd 0xff
    const name = [18, 1, 0, 0xfd, 0xff]
    const at = bytes.findIndex((_, i) => name.every((b, j) => bytes[i + j] === b))
    expect(at).toBeGreaterThan(0)
  })

  it('keeps the bytes of names that are not windows-1252 text (UTF-8 written by other tools)', () => {
    // "jalape�o" saved as UTF-8 by the tool that produced the 9.60 and 10.98 OTBs
    const utf8Name = 'jalapeï¿½o pepper'
    const otb = Otb()
    const bytes = otb.write({ schemaVersion: SCHEMA, items: [named(utf8Name)] })
    expect(otb.load(bytes).get(100)?.attributes.name).toBe(utf8Name)
    expect(otb.write(otb.load(bytes))).toEqual(bytes)
  })

  it('refuses to write a name windows-1252 cannot encode', () => {
    expect(() => Otb().write({ schemaVersion: SCHEMA, items: [named('łąka')] })).toThrow(
      UnencodableTextError
    )
  })
})
