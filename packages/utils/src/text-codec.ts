import { UnencodableTextError } from './errors.js'
import type { TextCodec, TextCodecName } from './types.js'

const ALL_BYTES = Uint8Array.from({ length: 256 }, (_, i) => i)

/**
 * A single-byte codec built from the platform's WHATWG decoder. Decoding all 256 bytes gives 256
 * distinct characters for these code pages (undefined bytes map to the C1 control of the same
 * value), so the inverse table makes every byte round-trip.
 */
function singleByteCodec(name: TextCodecName): TextCodec {
  const decoder = new TextDecoder(name)
  const table = decoder.decode(ALL_BYTES)
  const inverse = new Map<number, number>()
  for (let byte = 0; byte < 256; byte++) inverse.set(table.charCodeAt(byte), byte)

  const byteOf = (code: number): number | undefined => (code < 0x80 ? code : inverse.get(code))

  return {
    name,
    decode: (bytes) => decoder.decode(bytes),
    encode(text) {
      const out = new Uint8Array(text.length)
      for (let i = 0; i < text.length; i++) {
        const byte = byteOf(text.charCodeAt(i))
        if (byte === undefined) throw new UnencodableTextError(name, text, i)
        out[i] = byte
      }
      return out
    },
    canEncode(text) {
      for (let i = 0; i < text.length; i++) {
        if (byteOf(text.charCodeAt(i)) === undefined) return false
      }
      return true
    }
  }
}

/** Lone surrogates U+DC80..U+DCFF stand for bytes that are not valid UTF-8 (PEP 383). */
const ESCAPED_BYTE_BASE = 0xdc00

const strictUtf8 = new TextDecoder('utf-8', { fatal: true })

function decodeUtf8(bytes: Uint8Array): string {
  try {
    return strictUtf8.decode(bytes)
  } catch {
    return decodeUtf8Escaping(bytes)
  }
}

const inRange = (value: number, min: number, max: number): boolean => value >= min && value <= max

/** Length of the UTF-8 sequence a lead byte announces, or 0 when it cannot start one. */
function sequenceLength(lead: number): number {
  if (lead < 0x80) return 1
  if (inRange(lead, 0xc2, 0xdf)) return 2
  if (inRange(lead, 0xe0, 0xef)) return 3
  if (inRange(lead, 0xf0, 0xf4)) return 4
  return 0
}

/** Decodes valid sequences normally and maps each byte of an invalid one to U+DC80..U+DCFF. */
function decodeUtf8Escaping(bytes: Uint8Array): string {
  let out = ''
  let i = 0
  while (i < bytes.length) {
    const b0 = bytes[i]!
    const length = sequenceLength(b0)
    if (length === 1) {
      out += String.fromCharCode(b0)
      i++
      continue
    }
    const isCompleteSequence = length > 0 && i + length <= bytes.length
    if (isCompleteSequence) {
      try {
        out += strictUtf8.decode(bytes.subarray(i, i + length))
        i += length
        continue
      } catch {
        // falls through to escaping the lead byte
      }
    }
    out += String.fromCharCode(ESCAPED_BYTE_BASE + b0)
    i++
  }
  return out
}

function encodeUtf8(text: string): Uint8Array {
  const out: number[] = []
  for (let i = 0; i < text.length; i++) {
    let code = text.charCodeAt(i)
    const isEscapedByte = inRange(code, 0xdc80, 0xdcff)
    const isHighSurrogate = inRange(code, 0xd800, 0xdbff)
    const isLoneLowSurrogate = inRange(code, 0xdc00, 0xdfff)
    if (isEscapedByte) {
      out.push(code - ESCAPED_BYTE_BASE)
      continue
    }
    if (isHighSurrogate) {
      const low = text.charCodeAt(i + 1)
      const isPaired = inRange(low, 0xdc00, 0xdfff)
      if (!isPaired) throw new UnencodableTextError('utf-8', text, i)
      code = 0x10000 + ((code - 0xd800) << 10) + (low - 0xdc00)
      i++
    } else if (isLoneLowSurrogate) {
      throw new UnencodableTextError('utf-8', text, i)
    }
    if (code < 0x80) out.push(code)
    else if (code < 0x800) out.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f))
    else if (code < 0x10000) {
      out.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f))
    } else {
      out.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f)
      )
    }
  }
  return Uint8Array.from(out)
}

const utf8Codec: TextCodec = {
  name: 'utf-8',
  decode: decodeUtf8,
  encode: encodeUtf8,
  canEncode(text) {
    try {
      encodeUtf8(text)
      return true
    } catch {
      return false
    }
  }
}

/** Western European (Portuguese, English, Spanish, German); the toolkit default. */
export const windows1252: TextCodec = singleByteCodec('windows-1252')
/** Central European (Polish, Czech). */
export const windows1250: TextCodec = singleByteCodec('windows-1250')
/** Cyrillic (Russian). */
export const windows1251: TextCodec = singleByteCodec('windows-1251')
/** UTF-8; invalid bytes are kept as U+DC80..U+DCFF so they round-trip. */
export const utf8: TextCodec = utf8Codec

export const TEXT_CODECS: readonly TextCodec[] = [windows1252, windows1250, windows1251, utf8]
