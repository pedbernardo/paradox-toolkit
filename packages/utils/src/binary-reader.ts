import { BufferOverflowError, ByteNotFoundError } from './errors.js'

export type BinaryReader = {
  u8(): number
  u16(): number
  u32(): number
  str(n: number, encoding?: string): string
  bytes(n: number): Uint8Array
  u16arr(n: number): number[]
  skip(n: number): void
  seek(pos: number): void
  seekByte(byte: number): void
  seekAnyByte(targets: readonly number[]): number
  peekU8At(pos: number): number
  readonly isEOF: boolean
  readonly offset: number
  readonly byteLength: number
}

function toDataView(source: ArrayBuffer | Uint8Array): DataView {
  if (source instanceof Uint8Array) {
    return new DataView(source.buffer, source.byteOffset, source.byteLength)
  }
  return new DataView(source)
}

function buildReaderCore(view: DataView): BinaryReader {
  let cursor = 0

  return {
    get offset() {
      return cursor
    },

    get byteLength() {
      return view.byteLength
    },

    get isEOF() {
      return cursor === view.byteLength
    },

    u8() {
      if (cursor + 1 > view.byteLength) {
        throw new BufferOverflowError(`u8() overflow at offset=${cursor}`)
      }
      return view.getUint8(cursor++)
    },

    u16() {
      if (cursor + 2 > view.byteLength) {
        throw new BufferOverflowError(`u16() overflow at offset=${cursor}`)
      }
      const val = view.getUint16(cursor, true)
      cursor += 2
      return val
    },

    u32() {
      if (cursor + 4 > view.byteLength) {
        throw new BufferOverflowError(`u32() overflow at offset=${cursor}`)
      }
      const val = view.getUint32(cursor, true)
      cursor += 4
      return val
    },

    str(n, encoding) {
      if (cursor + n > view.byteLength) {
        throw new BufferOverflowError(`str(${n}) overflow at offset=${cursor}`)
      }
      const slice = new Uint8Array(view.buffer, view.byteOffset + cursor, n)
      cursor += n
      return new TextDecoder(encoding ?? 'latin1').decode(slice)
    },

    bytes(n) {
      if (cursor + n > view.byteLength) {
        throw new BufferOverflowError(`bytes(${n}) overflow at offset=${cursor}`)
      }
      const result = new Uint8Array(view.buffer, view.byteOffset + cursor, n)
      cursor += n
      return result
    },

    u16arr(n) {
      const bytesNeeded = n * 2
      if (cursor + bytesNeeded > view.byteLength) {
        throw new BufferOverflowError(`u16arr(${n}) overflow at offset=${cursor}`)
      }
      const out: number[] = new Array(n)
      for (let i = 0; i < n; i++) {
        out[i] = view.getUint16(cursor, true)
        cursor += 2
      }
      return out
    },

    skip(n) {
      if (cursor + n > view.byteLength) {
        throw new BufferOverflowError(`skip(${n}) overflow at offset=${cursor}`)
      }
      cursor += n
    },

    seek(pos) {
      if (pos < 0 || pos > view.byteLength) {
        throw new BufferOverflowError(`seek(${pos}) out of bounds, byteLength=${view.byteLength}`)
      }
      cursor = pos
    },

    seekByte(byte) {
      const saved = cursor
      while (cursor < view.byteLength) {
        if (view.getUint8(cursor++) === byte) return
      }
      cursor = saved
      throw new ByteNotFoundError(`seekByte(0x${byte.toString(16).padStart(2, '0')}) not found`)
    },

    seekAnyByte(targets) {
      const saved = cursor
      while (cursor < view.byteLength) {
        const b = view.getUint8(cursor++)
        if (targets.includes(b)) return b
      }
      cursor = saved
      throw new ByteNotFoundError(
        `seekAnyByte([${targets.map((t) => '0x' + t.toString(16).padStart(2, '0')).join(', ')}]) not found`
      )
    },

    peekU8At(pos) {
      if (pos >= view.byteLength) {
        throw new BufferOverflowError(
          `peekU8At(${pos}) out of bounds, byteLength=${view.byteLength}`
        )
      }
      return view.getUint8(pos)
    }
  }
}

export function createBinaryReader(source: ArrayBuffer | Uint8Array): BinaryReader {
  return buildReaderCore(toDataView(source))
}

export type EscapedBinaryReader = BinaryReader & {
  escU8(): number
  escU16(): number
  escU32(): number
  escU64(): number
  escStr(n: number, encoding?: string): string
  escBytes(n: number): Uint8Array
  seekNodeBoundary(targets: readonly number[]): number
}

/**
 * Reader for OTB/OTBM binary formats, which reserve 0xFE (node start) and 0xFF
 * (node end) as structural markers. Any data byte >= 0xFD is prefixed with the
 * escape marker 0xFD, so [0xFD, 0xFE] decodes to data byte 0xFE. Use esc*
 * methods for data fields; use base methods (seekAnyByte, u8…) to navigate
 * node boundaries.
 *
 * @example
 * const r = createEscapedBinaryReader(buffer)
 * r.seekAnyByte([0xfe])  // find node start (raw)
 * const serverId = r.escU16()  // read data field (escape-aware)
 */
export type EscapedSliceReader = {
  seekWindow(begin: number, end: number): void
  u8(): number
  u16(): number
  u32(): number
  str(len: number): string
  skip(n: number): void
  readonly isEOF: boolean
}

/**
 * Zero-allocation escape-aware reader for a bounded slice of a Uint8Array.
 * Call seekWindow(begin, end) before each props block to reposition the cursor.
 * Each read transparently skips escape markers (default 0xFD) and returns the
 * following byte as the data value. Throws BufferOverflowError if a read
 * exceeds the current window.
 */
export function createEscapedSliceReader(
  bytes: Uint8Array,
  escapeMarker = 0xfd
): EscapedSliceReader {
  let i = 0
  let windowEnd = bytes.length

  function readEscapedByte(): number {
    if (i >= windowEnd) throw new BufferOverflowError(`read overflow at offset=${i}`)
    if (bytes[i] === escapeMarker) {
      i++
      if (i >= bytes.length) throw new BufferOverflowError(`escape overflow at offset=${i}`)
    }
    return bytes[i++]!
  }

  return {
    seekWindow(begin: number, end: number): void {
      i = begin
      windowEnd = end
    },

    get isEOF(): boolean {
      return i >= windowEnd
    },

    u8(): number {
      return readEscapedByte()
    },

    u16(): number {
      const lo = readEscapedByte()
      const hi = readEscapedByte()
      return lo | (hi << 8)
    },

    u32(): number {
      const b0 = readEscapedByte()
      const b1 = readEscapedByte()
      const b2 = readEscapedByte()
      const b3 = readEscapedByte()
      return (b0 | (b1 << 8) | (b2 << 16) | (b3 << 24)) >>> 0
    },

    str(len: number): string {
      let s = ''
      for (let j = 0; j < len; j++) {
        s += String.fromCharCode(readEscapedByte())
      }
      return s
    },

    skip(n: number): void {
      for (let j = 0; j < n; j++) {
        readEscapedByte()
      }
    }
  }
}

export function createEscapedBinaryReader(
  source: ArrayBuffer | Uint8Array,
  escapeMarker = 0xfd
): EscapedBinaryReader {
  const base = createBinaryReader(source)

  function readEscapedByte(): number {
    const b = base.u8()
    return b === escapeMarker ? base.u8() : b
  }

  return {
    get offset() {
      return base.offset
    },
    get byteLength() {
      return base.byteLength
    },
    get isEOF() {
      return base.isEOF
    },
    u8: () => base.u8(),
    u16: () => base.u16(),
    u32: () => base.u32(),
    str(n, encoding) {
      return base.str(n, encoding)
    },
    bytes: (n) => base.bytes(n),
    u16arr: (n) => base.u16arr(n),
    skip: (n) => base.skip(n),
    seek: (pos) => base.seek(pos),
    seekByte: (byte) => base.seekByte(byte),
    seekAnyByte: (targets) => base.seekAnyByte(targets),
    peekU8At: (pos) => base.peekU8At(pos),

    escU8: readEscapedByte,

    escU16() {
      const lo = readEscapedByte()
      const hi = readEscapedByte()
      return lo | (hi << 8)
    },

    escU32() {
      const b0 = readEscapedByte()
      const b1 = readEscapedByte()
      const b2 = readEscapedByte()
      const b3 = readEscapedByte()
      return (b0 | (b1 << 8) | (b2 << 16) | (b3 << 24)) >>> 0
    },

    escStr(n, encoding) {
      const buf = new Uint8Array(n)
      for (let i = 0; i < n; i++) {
        buf[i] = readEscapedByte()
      }
      return new TextDecoder(encoding ?? 'latin1').decode(buf)
    },

    escU64() {
      const lo =
        (readEscapedByte() |
          (readEscapedByte() << 8) |
          (readEscapedByte() << 16) |
          (readEscapedByte() << 24)) >>>
        0
      const hi =
        (readEscapedByte() |
          (readEscapedByte() << 8) |
          (readEscapedByte() << 16) |
          (readEscapedByte() << 24)) >>>
        0
      return hi * 0x100000000 + lo
    },

    escBytes(n) {
      const result = new Uint8Array(n)
      for (let i = 0; i < n; i++) {
        result[i] = readEscapedByte()
      }
      return result
    },

    seekNodeBoundary(targets) {
      const saved = base.offset
      while (!base.isEOF) {
        const b = base.u8()
        if (b === escapeMarker) {
          if (base.isEOF) break
          base.u8()
        } else if (targets.includes(b)) {
          return b
        }
      }
      base.seek(saved)
      throw new ByteNotFoundError(
        `seekNodeBoundary([${targets.map((t) => '0x' + t.toString(16).padStart(2, '0')).join(', ')}]) not found`
      )
    }
  }
}
