import { utf8, windows1250, windows1251, windows1252 } from './text-codec.js'
import type { TextCodec, TextCodecSuggestion } from './types.js'

const strictUtf8 = new TextDecoder('utf-8', { fatal: true })

const LETTER = /\p{L}/u
const CYRILLIC = /\p{Script=Cyrillic}/u

/** Characters typical of text written for each single-byte code page. */
const EVIDENCE: ReadonlyMap<TextCodec, ReadonlySet<string>> = new Map([
  // Portuguese, Spanish, French and German letters, and Windows typography
  [windows1252, new Set('ãõâêôàçñüäößÃÕÂÊÔÀÇÑÜÄÖ’‘“”–—…€')],
  // Polish and Czech letters
  [windows1250, new Set('ąćęłńśźżěščřůďťňĄĆĘŁŃŚŹŻĚŠČŘŮĎŤŇ')],
  // Cyrillic
  [windows1251, new Set(Array.from({ length: 64 }, (_, i) => String.fromCharCode(0x410 + i)))]
])

/** Punctuation that may sit next to letters without suggesting a wrong code page. */
const TYPOGRAPHY = new Set('’‘“”–—…«»„')

const isLetter = (char: string | undefined): boolean => char !== undefined && LETTER.test(char)
const isCyrillic = (char: string): boolean => CYRILLIC.test(char)

/**
 * Plausibility of `bytes` decoded by a single-byte `codec`: +1 per high byte that decodes to a
 * character typical of the code page, -1 per high byte that decodes to a letter of another script
 * than a neighboring letter, or to a symbol inside a word. Single-byte codecs map byte i to char i.
 */
function plausibility(codec: TextCodec, evidence: ReadonlySet<string>, bytes: Uint8Array): number {
  const text = codec.decode(bytes)
  const usesLatinScript = codec !== windows1251
  let score = usesLatinScript ? -implausibleLatinWords(text, bytes) : 0
  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i]! < 0x80) continue
    const char = text[i]!
    const neighbors = [text[i - 1], text[i + 1]].filter(isLetter) as string[]
    const isTypical = evidence.has(char)
    if (isLetter(char)) {
      const mixesScripts = neighbors.some((n) => isCyrillic(n) !== isCyrillic(char))
      if (mixesScripts) score--
      else if (isTypical) score++
    } else {
      const touchesLetters = neighbors.length > 0
      const isStrayInsideWord = touchesLetters && !TYPOGRAPHY.has(char) && !isTypical
      if (isStrayInsideWord) score--
      else if (isTypical) score++
    }
  }
  return score
}

/**
 * High bytes inside words of 5+ letters that are more than 70% high bytes. Latin-script languages
 * mark a minority of letters; a word made almost entirely of accented letters (`Äîáðî`) is Cyrillic
 * read with a Latin code page.
 */
function implausibleLatinWords(text: string, bytes: Uint8Array): number {
  let penalty = 0
  let start = -1
  for (let i = 0; i <= text.length; i++) {
    const isInsideWord = i < text.length && isLetter(text[i])
    if (isInsideWord) {
      if (start < 0) start = i
      continue
    }
    if (start >= 0) {
      const length = i - start
      let highs = 0
      for (let j = start; j < i; j++) if (bytes[j]! >= 0x80) highs++
      const isLongWord = length >= 5
      const isMostlyAccented = highs / length > 0.7
      if (isLongWord && isMostlyAccented) penalty += highs
      start = -1
    }
  }
  return penalty
}

const hasHighByte = (bytes: Uint8Array): boolean => bytes.some((b) => b >= 0x80)

function isValidUtf8(bytes: Uint8Array): boolean {
  try {
    strictUtf8.decode(bytes)
    return true
  } catch {
    return false
  }
}

const samplesOf = (codec: TextCodec, strings: readonly Uint8Array[]): string[] =>
  strings.slice(0, 5).map((bytes) => codec.decode(bytes))

/**
 * Suggests the text codec of a file from its strings. It never decides: a consumer shows
 * the suggestion with its samples, and the user confirms.
 *
 * - No byte at or above 0x80: windows-1252 with confidence 1 (every codec reads ASCII the same).
 * - UTF-8 when at least 90% of the strings with high bytes are valid UTF-8; single-byte text almost
 *   never forms valid multi-byte sequences by accident.
 * - Otherwise the single-byte code page whose decoding is the most plausible (see `plausibility`).
 *   Confidence is its share of the positive scores.
 */
export function detectTextCodec(strings: Iterable<Uint8Array>): TextCodecSuggestion {
  const all: Uint8Array[] = []
  const high: Uint8Array[] = []

  for (const bytes of strings) {
    all.push(bytes)
    if (hasHighByte(bytes)) high.push(bytes)
  }

  if (high.length === 0) {
    return { codec: windows1252, confidence: 1, samples: samplesOf(windows1252, all) }
  }

  const validUtf8 = high.filter(isValidUtf8).length

  if (validUtf8 / high.length >= 0.9) {
    return { codec: utf8, confidence: validUtf8 / high.length, samples: samplesOf(utf8, high) }
  }

  let best = windows1252
  let bestScore = 0
  let positive = 0

  for (const [codec, evidence] of EVIDENCE) {
    let score = 0
    for (const bytes of high) score += plausibility(codec, evidence, bytes)
    if (score > 0) positive += score
    if (score > bestScore) {
      best = codec
      bestScore = score
    }
  }

  return {
    codec: best,
    confidence: positive === 0 ? 0 : bestScore / positive,
    samples: samplesOf(best, high)
  }
}
