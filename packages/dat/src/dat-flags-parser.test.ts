import { describe, expect, it } from 'vitest'
import { createBinaryReader, createBinaryWriter } from '@paradoxlab/utils'
import { getDatFlags } from './dat-flags.js'
import { createFlagsParser, createWriteRules } from './dat-flags-parser.js'

describe('createFlagsParser', () => {
  describe('simple flags (boolean)', () => {
    it('parses a simple flag into { flagName: true }', () => {
      const parser = createFlagsParser(getDatFlags(710), 710)
      const flagInt = getDatFlags(710)['CONTAINER']!
      expect(parser.parse(flagInt, createBinaryReader(new ArrayBuffer(0)))).toEqual({
        container: true
      })
    })

    it('parses STACKABLE correctly', () => {
      const flags = getDatFlags(772)
      const parser = createFlagsParser(flags, 772)
      expect(parser.parse(flags['STACKABLE']!, createBinaryReader(new ArrayBuffer(0)))).toEqual({
        stackable: true
      })
    })
  })

  describe('advanced flags with one sub-field', () => {
    it('parses GROUND into { ground: { speed } }', () => {
      const flags = getDatFlags(710)
      const parser = createFlagsParser(flags, 710)
      const reader = createBinaryReader(new Uint8Array([0x05, 0x00]).buffer)
      expect(parser.parse(flags['GROUND']!, reader)).toEqual({ ground: { speed: 5 } })
    })

    it('parses HAS_ELEVATION into { hasElevation: { height } }', () => {
      const flags = getDatFlags(772)
      const parser = createFlagsParser(flags, 772)
      const reader = createBinaryReader(new Uint8Array([0x08, 0x00]).buffer)
      expect(parser.parse(flags['HAS_ELEVATION']!, reader)).toEqual({
        hasElevation: { height: 8 }
      })
    })

    it('parses CLOTH into { cloth: { slot } } (8.6+)', () => {
      const flags = getDatFlags(860)
      const parser = createFlagsParser(flags, 860)
      const reader = createBinaryReader(new Uint8Array([0x05, 0x00]).buffer)
      expect(parser.parse(flags['CLOTH']!, reader)).toEqual({ cloth: { slot: 5 } })
    })

    it('parses USABLE into { usable: { value } } (8.6+)', () => {
      const flags = getDatFlags(860)
      const parser = createFlagsParser(flags, 860)
      const reader = createBinaryReader(new Uint8Array([0x0a, 0x00]).buffer)
      expect(parser.parse(flags['USABLE']!, reader)).toEqual({ usable: { value: 10 } })
    })
  })

  describe('advanced flags with multiple sub-fields', () => {
    it('parses LIGHT_INFO into { lightInfo: { level, color } }', () => {
      const flags = getDatFlags(772)
      const parser = createFlagsParser(flags, 772)
      const reader = createBinaryReader(new Uint8Array([0x03, 0x00, 0xd7, 0x00]).buffer)
      expect(parser.parse(flags['LIGHT_INFO']!, reader)).toEqual({
        lightInfo: { level: 3, color: 215 }
      })
    })

    it('parses HAS_OFFSET into { hasOffset: { offsetX, offsetY } } (755+)', () => {
      const flags = getDatFlags(772)
      const parser = createFlagsParser(flags, 772)
      const reader = createBinaryReader(new Uint8Array([0x08, 0x00, 0x10, 0x00]).buffer)
      expect(parser.parse(flags['HAS_OFFSET']!, reader)).toEqual({
        hasOffset: { offsetX: 8, offsetY: 16 }
      })
    })
  })

  describe('MARKET flag (9.6+)', () => {
    it('parses MARKET returning full MarketData object', () => {
      const flags = getDatFlags(960)
      const parser = createFlagsParser(flags, 960)
      // u16 category, u16 tradeAs, u16 showAs, u16 nameLen=3, bytes "abc", u16 restrictVocation, u16 requiredLevel
      const bytes = new Uint8Array([
        0x08,
        0x00, // category = 8
        0x01,
        0x00, // tradeAs = 1
        0x08,
        0x00, // showAs = 8
        0x03,
        0x00, // nameLen = 3
        0x61,
        0x62,
        0x63, // "abc"
        0x00,
        0x00, // restrictVocation = 0
        0x01,
        0x00 // requiredLevel = 1
      ])
      expect(parser.parse(flags['MARKET']!, createBinaryReader(bytes.buffer))).toEqual({
        market: {
          category: 8,
          tradeAs: 1,
          showAs: 8,
          name: 'abc',
          restrictVocation: 0,
          requiredLevel: 1
        }
      })
    })

    it('MARKET: cursor advances past all 15 bytes (6 + 2 + 3 + 4)', () => {
      const flags = getDatFlags(960)
      const parser = createFlagsParser(flags, 960)
      const bytes = new Uint8Array([
        0x08,
        0x00, // category
        0x01,
        0x00, // tradeAs
        0x08,
        0x00, // showAs
        0x03,
        0x00, // nameLen = 3
        0x61,
        0x62,
        0x63, // "abc"
        0x00,
        0x00, // restrictVocation
        0x01,
        0x00 // requiredLevel
      ])
      const reader = createBinaryReader(bytes.buffer)
      parser.parse(flags['MARKET']!, reader)
      expect(reader.offset).toBe(15)
    })
  })

  describe('HAS_OFFSET version-dependent behavior', () => {
    it('is boolean in version 740 (no extra bytes consumed)', () => {
      const flags = getDatFlags(740)
      const parser = createFlagsParser(flags, 740)
      const reader = createBinaryReader(new Uint8Array([0x01, 0x02]).buffer)
      expect(parser.parse(flags['HAS_OFFSET']!, reader)).toEqual({ hasOffset: true })
      expect(reader.offset).toBe(0)
    })

    it('is boolean in version 750 (no extra bytes consumed)', () => {
      const flags = getDatFlags(750)
      const parser = createFlagsParser(flags, 750)
      const reader = createBinaryReader(new Uint8Array([0x01, 0x02]).buffer)
      expect(parser.parse(flags['HAS_OFFSET']!, reader)).toEqual({ hasOffset: true })
      expect(reader.offset).toBe(0)
    })

    it('reads 2x u16 in version 772 (offsetX + offsetY)', () => {
      const flags = getDatFlags(772)
      const parser = createFlagsParser(flags, 772)
      const reader = createBinaryReader(new Uint8Array([0x08, 0x00, 0x10, 0x00]).buffer)
      expect(parser.parse(flags['HAS_OFFSET']!, reader)).toEqual({
        hasOffset: { offsetX: 8, offsetY: 16 }
      })
      expect(reader.offset).toBe(4)
    })
  })

  describe('unknown flags', () => {
    it('returns null for unknown flag int (skip, no throw)', () => {
      const parser = createFlagsParser(getDatFlags(772), 772)
      expect(parser.parse(999, createBinaryReader(new ArrayBuffer(0)))).toBeNull()
    })

    it('returns null without consuming any bytes from reader', () => {
      const parser = createFlagsParser(getDatFlags(772), 772)
      const reader = createBinaryReader(new Uint8Array([0x01, 0x02]).buffer)
      parser.parse(999, reader)
      expect(reader.offset).toBe(0)
    })
  })
})

describe('createWriteRules', () => {
  describe('simple flags', () => {
    it('serialize stackable emits exactly 1 byte with the correct flag value', () => {
      const flags = getDatFlags(772)
      const rules = createWriteRules(flags, 772)
      const w = createBinaryWriter()
      rules.serialize('stackable', true, w)
      const out = w.finish()
      expect(out).toHaveLength(1)
      expect(out[0]).toBe(flags['STACKABLE'])
    })

    it('serialize groundBorder emits 1 byte', () => {
      const flags = getDatFlags(772)
      const rules = createWriteRules(flags, 772)
      const w = createBinaryWriter()
      rules.serialize('groundBorder', true, w)
      expect(w.finish()).toHaveLength(1)
    })
  })

  describe('flags with u16 payload', () => {
    it('serialize ground emits flag byte + u16(speed)', () => {
      const flags = getDatFlags(772)
      const rules = createWriteRules(flags, 772)
      const w = createBinaryWriter()
      rules.serialize('ground', { speed: 150 }, w)
      const out = w.finish()
      expect(out).toHaveLength(3)
      expect(out[0]).toBe(flags['GROUND'])
      expect(out[1]).toBe(150 & 0xff)
      expect(out[2]).toBe((150 >> 8) & 0xff)
    })

    it('serialize hasElevation emits flag byte + u16(height)', () => {
      const flags = getDatFlags(772)
      const rules = createWriteRules(flags, 772)
      const w = createBinaryWriter()
      rules.serialize('hasElevation', { height: 8 }, w)
      const out = w.finish()
      expect(out).toHaveLength(3)
      expect(out[0]).toBe(flags['HAS_ELEVATION'])
    })
  })

  describe('flags with two u16 payloads', () => {
    it('serialize lightInfo emits flag byte + u16(level) + u16(color)', () => {
      const flags = getDatFlags(772)
      const rules = createWriteRules(flags, 772)
      const w = createBinaryWriter()
      rules.serialize('lightInfo', { level: 5, color: 215 }, w)
      const out = w.finish()
      expect(out).toHaveLength(5)
      expect(out[0]).toBe(flags['LIGHT_INFO'])
      const view = new DataView(out.buffer)
      expect(view.getUint16(1, true)).toBe(5)
      expect(view.getUint16(3, true)).toBe(215)
    })
  })

  describe('MARKET flag', () => {
    it('serialize market emits flag byte + full market payload', () => {
      const flags = getDatFlags(960)
      const rules = createWriteRules(flags, 960)
      const w = createBinaryWriter()
      const market = {
        category: 1,
        tradeAs: 2,
        showAs: 3,
        name: 'Gold Coin',
        restrictVocation: 0,
        requiredLevel: 0
      }
      rules.serialize('market', market, w)
      const out = w.finish()
      // 1 (flag) + 2+2+2 (category+tradeAs+showAs) + 2+9 (nameLen+"Gold Coin") + 2+2 (vocation+level) = 22
      expect(out).toHaveLength(22)
      expect(out[0]).toBe(flags['MARKET'])
    })

    it('round-trip: writeRules output is parseable by flagsParser', () => {
      const flags = getDatFlags(960)
      const rules = createWriteRules(flags, 960)
      const parser = createFlagsParser(flags, 960)
      const w = createBinaryWriter()
      const market = {
        category: 3,
        tradeAs: 100,
        showAs: 200,
        name: 'Sword',
        restrictVocation: 1,
        requiredLevel: 10
      }
      rules.serialize('market', market, w)
      const out = w.finish()
      // skip the flag byte, then parse the payload
      const reader = createBinaryReader(out)
      const flagByte = reader.u8() // consume flag byte
      const result = parser.parse(flagByte, reader)
      expect(result).toEqual({ market })
    })
  })

  describe('HAS_OFFSET version-dependent behavior', () => {
    it('version 710: emits only flag byte (no payload)', () => {
      const flags = getDatFlags(710)
      const rules = createWriteRules(flags, 710)
      const w = createBinaryWriter()
      rules.serialize('hasOffset', true, w)
      expect(w.finish()).toHaveLength(1)
    })

    it('version 740: emits only flag byte (no payload)', () => {
      const flags = getDatFlags(740)
      const rules = createWriteRules(flags, 740)
      const w = createBinaryWriter()
      rules.serialize('hasOffset', { offsetX: 8, offsetY: 16 }, w)
      expect(w.finish()).toHaveLength(1)
    })

    it('version 772: emits flag byte + u16(offsetX) + u16(offsetY)', () => {
      const flags = getDatFlags(772)
      const rules = createWriteRules(flags, 772)
      const w = createBinaryWriter()
      rules.serialize('hasOffset', { offsetX: 8, offsetY: 16 }, w)
      expect(w.finish()).toHaveLength(5)
    })
  })

  describe('round-trip: write then parse', () => {
    it('ground round-trip', () => {
      const flags = getDatFlags(772)
      const rules = createWriteRules(flags, 772)
      const parser = createFlagsParser(flags, 772)
      const w = createBinaryWriter()
      rules.serialize('ground', { speed: 42 }, w)
      const out = w.finish()
      const reader = createBinaryReader(out)
      const flagByte = reader.u8()
      expect(parser.parse(flagByte, reader)).toEqual({ ground: { speed: 42 } })
    })

    it('lightInfo round-trip', () => {
      const flags = getDatFlags(772)
      const rules = createWriteRules(flags, 772)
      const parser = createFlagsParser(flags, 772)
      const w = createBinaryWriter()
      rules.serialize('lightInfo', { level: 7, color: 100 }, w)
      const out = w.finish()
      const reader = createBinaryReader(out)
      const flagByte = reader.u8()
      expect(parser.parse(flagByte, reader)).toEqual({ lightInfo: { level: 7, color: 100 } })
    })
  })
})
