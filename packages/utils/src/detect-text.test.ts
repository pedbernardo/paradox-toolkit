import { describe, expect, it } from 'vitest'
import { detectTextCodec } from './detect-text.js'
import { utf8, windows1250, windows1251, windows1252 } from './text-codec.js'

const encodeAll = (encode: (text: string) => Uint8Array, texts: string[]) => texts.map(encode)

const PORTUGUESE = [
  'Bem-vindo à cidade de São João',
  'Não toque na poção',
  'O ferreiro está na praça',
  'it’s a “trap” – beware…'
]
const POLISH = ['Witaj w mieście', 'Złoty łańcuch', 'Księżyc nad zamkiem', 'Uważaj na smoka']
const RUSSIAN = ['Добро пожаловать', 'Золотая монета', 'Осторожно, дракон']

describe('detectTextCodec', () => {
  it('returns windows-1252 with confidence 1 for pure ASCII', () => {
    const result = detectTextCodec(encodeAll(windows1252.encode, ['Hello', 'Depot', 'Temple']))
    expect(result.codec).toBe(windows1252)
    expect(result.confidence).toBe(1)
    expect(result.samples).toEqual(['Hello', 'Depot', 'Temple'])
  })

  it('detects Portuguese written in windows-1252', () => {
    const result = detectTextCodec(encodeAll(windows1252.encode, PORTUGUESE))
    expect(result.codec).toBe(windows1252)
    expect(result.confidence).toBeGreaterThan(0.8)
    expect(result.samples).toContain('Não toque na poção')
  })

  it('detects Polish written in windows-1250', () => {
    const result = detectTextCodec(encodeAll(windows1250.encode, POLISH))
    expect(result.codec).toBe(windows1250)
    expect(result.confidence).toBeGreaterThan(0.8)
    expect(result.samples).toContain('Złoty łańcuch')
  })

  it('detects Russian written in windows-1251', () => {
    const result = detectTextCodec(encodeAll(windows1251.encode, RUSSIAN))
    expect(result.codec).toBe(windows1251)
    expect(result.confidence).toBeGreaterThan(0.8)
  })

  it('detects UTF-8 in any language', () => {
    const result = detectTextCodec(encodeAll(utf8.encode, [...PORTUGUESE, ...POLISH]))
    expect(result.codec).toBe(utf8)
    expect(result.confidence).toBe(1)
  })

  it('returns the majority with lower confidence for a mixed file', () => {
    const strings = [
      ...encodeAll(windows1250.encode, POLISH),
      ...encodeAll(windows1252.encode, PORTUGUESE.slice(0, 1))
    ]
    const result = detectTextCodec(strings)
    expect(result.codec).toBe(windows1250)
    expect(result.confidence).toBeLessThan(1)
  })

  it('falls back to windows-1252 with confidence 0 when no codec finds evidence', () => {
    // 0xA0 is a no-break space in all three code pages: no evidence for any of them
    const result = detectTextCodec([Uint8Array.of(0x41, 0xa0, 0x42)])
    expect(result.codec).toBe(windows1252)
    expect(result.confidence).toBe(0)
  })

  it('does not take Polish words for Portuguese', () => {
    const result = detectTextCodec(encodeAll(windows1250.encode, ['Księżyc', 'Złoty']))
    expect(result.codec).toBe(windows1250)
  })
})
