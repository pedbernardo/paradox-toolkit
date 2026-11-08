import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { createBinaryWriter } from './binary-writer.js'
import { UnencodableTextError } from './errors.js'
import { createOutputBuffer } from './output-buffer.js'
import { TEXT_CODECS, utf8, windows1250, windows1251, windows1252 } from './text-codec.js'

const ALL_BYTES = Uint8Array.from({ length: 256 }, (_, i) => i)
const singleByte = [windows1252, windows1250, windows1251]

describe('single-byte codecs', () => {
  it.each(singleByte.map((codec) => [codec.name, codec] as const))(
    '%s decodes 256 bytes to 256 distinct characters and back',
    (_, codec) => {
      const text = codec.decode(ALL_BYTES)
      expect(text.length).toBe(256)
      expect(new Set(text).size).toBe(256)
      expect(codec.encode(text)).toEqual(ALL_BYTES)
    }
  )

  it('windows-1252 maps 0x92 to ’ and back', () => {
    expect(windows1252.decode(Uint8Array.of(0x92))).toBe('’')
    expect(windows1252.encode('it’s €5 … ãç')).toEqual(
      Uint8Array.of(0x69, 0x74, 0x92, 0x73, 0x20, 0x80, 0x35, 0x20, 0x85, 0x20, 0xe3, 0xe7)
    )
  })

  it('windows-1250 decodes Polish letters', () => {
    expect(windows1250.decode(Uint8Array.of(0xb3, 0xb9, 0xea, 0x9c, 0xbf))).toBe('łąęśż')
  })

  it('windows-1251 decodes Cyrillic', () => {
    expect(windows1251.decode(Uint8Array.of(0xcf, 0xf0, 0xe8))).toBe('При')
  })

  it.each(TEXT_CODECS.filter((c) => c !== utf8).map((c) => [c.name, c] as const))(
    '%s throws UnencodableTextError for an emoji, with its index',
    (_, codec) => {
      expect(codec.canEncode('ok 🙂')).toBe(false)
      try {
        codec.encode('ok 🙂')
        expect.unreachable()
      } catch (error) {
        expect(error).toBeInstanceOf(UnencodableTextError)
        expect((error as UnencodableTextError).index).toBe(3)
        expect((error as UnencodableTextError).codec).toBe(codec.name)
      }
    }
  )

  it('windows-1252 cannot encode Polish ł', () => {
    expect(windows1252.canEncode('ł')).toBe(false)
    expect(windows1250.canEncode('ł')).toBe(true)
  })

  it.each(singleByte.map((codec) => [codec.name, codec] as const))(
    '%s round-trips arbitrary bytes',
    (_, codec) => {
      fc.assert(
        fc.property(fc.uint8Array({ maxLength: 512 }), (bytes) => {
          expect(codec.encode(codec.decode(bytes))).toEqual(bytes)
        })
      )
    }
  )
})

describe('utf8', () => {
  it('round-trips ã as C3 A3 and astral characters', () => {
    expect(utf8.encode('ã')).toEqual(Uint8Array.of(0xc3, 0xa3))
    expect(utf8.decode(utf8.encode('mapa 🙂 ł'))).toBe('mapa 🙂 ł')
  })

  it('keeps invalid bytes as U+DC80..U+DCFF and writes them back', () => {
    const bytes = Uint8Array.of(0x61, 0xe3, 0x62, 0xff, 0xc3, 0xa3)
    const text = utf8.decode(bytes)
    expect(text).toBe('a\udce3b\udcffã')
    expect(utf8.encode(text)).toEqual(bytes)
  })

  it('rejects lone surrogates outside the escape range', () => {
    expect(utf8.canEncode('\ud800')).toBe(false)
    expect(() => utf8.encode('x\udc00')).toThrow(UnencodableTextError)
  })

  it('round-trips arbitrary bytes, valid or not', () => {
    fc.assert(
      fc.property(fc.uint8Array({ maxLength: 512 }), (bytes) => {
        expect(utf8.encode(utf8.decode(bytes))).toEqual(bytes)
      })
    )
  })
})

describe('writers encode with their codec', () => {
  it('createBinaryWriter writes the encoded byte length', () => {
    const w = createBinaryWriter({ text: utf8 })
    w.str('ã')
    expect(w.finish()).toEqual(Uint8Array.of(2, 0, 0xc3, 0xa3))
  })

  it('createOutputBuffer escapes the length and the encoded bytes', () => {
    const out = createOutputBuffer()
    out.escStr('ÿ')
    expect(out.take()).toEqual(Uint8Array.of(1, 0, 0xfd, 0xff))
  })

  it('writers throw instead of substituting a character', () => {
    const out = createOutputBuffer({ text: windows1252 })
    expect(() => out.escStr('ł')).toThrow(UnencodableTextError)
  })
})
