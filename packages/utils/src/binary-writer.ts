import { windows1252 } from './text-codec.js'
import type { TextOptions } from './types.js'

export type BinaryWriter = {
  u8(v: number): void
  u16(v: number): void
  u32(v: number): void
  str(s: string): void
  bytes(b: Uint8Array): void
  finish(): Uint8Array
  readonly length: number
}

export function createBinaryWriter(options: TextOptions = {}): BinaryWriter {
  const text = options.text ?? windows1252
  let buf = new Uint8Array(65536)
  let len = 0

  function ensure(n: number): void {
    if (len + n <= buf.length) return
    let next = buf.length
    while (next < len + n) next *= 2
    const grown = new Uint8Array(next)
    grown.set(buf)
    buf = grown
  }

  return {
    get length() {
      return len
    },

    u8(v: number): void {
      ensure(1)
      buf[len++] = v & 0xff
    },

    u16(v: number): void {
      ensure(2)
      buf[len++] = v & 0xff
      buf[len++] = (v >> 8) & 0xff
    },

    u32(v: number): void {
      ensure(4)
      buf[len++] = v & 0xff
      buf[len++] = (v >> 8) & 0xff
      buf[len++] = (v >> 16) & 0xff
      buf[len++] = (v >>> 24) & 0xff
    },

    str(s: string): void {
      const encoded = text.encode(s)
      ensure(2 + encoded.length)
      buf[len++] = encoded.length & 0xff
      buf[len++] = (encoded.length >> 8) & 0xff
      buf.set(encoded, len)
      len += encoded.length
    },

    bytes(b: Uint8Array): void {
      ensure(b.length)
      buf.set(b, len)
      len += b.length
    },

    finish(): Uint8Array {
      return buf.slice(0, len)
    }
  }
}
