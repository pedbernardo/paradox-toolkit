const DEFAULT_ESCAPE_MARKER = 0xfd

export type BinaryWriter = {
  u8(v: number): void
  u16(v: number): void
  u32(v: number): void
  str(s: string): void
  bytes(b: Uint8Array): void
  finish(): Uint8Array
  readonly length: number
}

export type EscapedBinaryWriter = BinaryWriter & {
  escU8(v: number): void
  escU16(v: number): void
  escU32(v: number): void
  escU64(v: number): void
  escStr(s: string): void
  escBytes(b: Uint8Array): void
}

export function createBinaryWriter(): BinaryWriter {
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
      const sLen = s.length
      ensure(2 + sLen)
      buf[len++] = sLen & 0xff
      buf[len++] = (sLen >> 8) & 0xff
      for (let i = 0; i < sLen; i++) {
        buf[len++] = s.charCodeAt(i) & 0xff
      }
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

export function createEscapedBinaryWriter(
  escapeMarker = DEFAULT_ESCAPE_MARKER
): EscapedBinaryWriter {
  const base = createBinaryWriter()

  function writeEscapedByte(b: number): void {
    const byte = b & 0xff
    if (byte >= escapeMarker) base.u8(escapeMarker)
    base.u8(byte)
  }

  return {
    get length() {
      return base.length
    },

    u8: (v) => base.u8(v),
    u16: (v) => base.u16(v),
    u32: (v) => base.u32(v),
    str: (s) => base.str(s),
    bytes: (b) => base.bytes(b),
    finish: () => base.finish(),

    escU8(v: number): void {
      writeEscapedByte(v)
    },

    escU16(v: number): void {
      writeEscapedByte(v & 0xff)
      writeEscapedByte((v >> 8) & 0xff)
    },

    escU32(v: number): void {
      writeEscapedByte(v & 0xff)
      writeEscapedByte((v >> 8) & 0xff)
      writeEscapedByte((v >> 16) & 0xff)
      writeEscapedByte((v >>> 24) & 0xff)
    },

    escU64(v: number): void {
      const lo = v >>> 0
      const hi = Math.floor(v / 0x100000000) >>> 0
      writeEscapedByte(lo & 0xff)
      writeEscapedByte((lo >> 8) & 0xff)
      writeEscapedByte((lo >> 16) & 0xff)
      writeEscapedByte((lo >>> 24) & 0xff)
      writeEscapedByte(hi & 0xff)
      writeEscapedByte((hi >> 8) & 0xff)
      writeEscapedByte((hi >> 16) & 0xff)
      writeEscapedByte((hi >>> 24) & 0xff)
    },

    escStr(s: string): void {
      const sLen = s.length
      writeEscapedByte(sLen & 0xff)
      writeEscapedByte((sLen >> 8) & 0xff)
      for (let i = 0; i < sLen; i++) {
        writeEscapedByte(s.charCodeAt(i) & 0xff)
      }
    },

    escBytes(b: Uint8Array): void {
      for (let i = 0; i < b.length; i++) {
        writeEscapedByte(b[i]!)
      }
    }
  }
}
