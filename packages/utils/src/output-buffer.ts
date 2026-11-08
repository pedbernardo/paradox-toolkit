import type { OutputBuffer, OutputBufferOptions } from './types.js'

const ESCAPE = 0xfd
const DEFAULT_INITIAL_BYTES = 1 << 20

class GrowingOutputBuffer implements OutputBuffer {
  #buf: Uint8Array
  #len = 0

  constructor(initialBytes: number) {
    this.#buf = new Uint8Array(Math.max(16, initialBytes))
  }

  get length(): number {
    return this.#len
  }

  #ensure(n: number): void {
    if (this.#len + n <= this.#buf.length) return
    let next = this.#buf.length * 2
    while (next < this.#len + n) next *= 2
    const grown = new Uint8Array(next)
    grown.set(this.#buf.subarray(0, this.#len))
    this.#buf = grown
  }

  u8(value: number): void {
    this.#ensure(1)
    this.#buf[this.#len++] = value & 0xff
  }

  u16(value: number): void {
    this.#ensure(2)
    const buf = this.#buf
    buf[this.#len++] = value & 0xff
    buf[this.#len++] = (value >> 8) & 0xff
  }

  u32(value: number): void {
    this.#ensure(4)
    const buf = this.#buf
    buf[this.#len++] = value & 0xff
    buf[this.#len++] = (value >> 8) & 0xff
    buf[this.#len++] = (value >> 16) & 0xff
    buf[this.#len++] = (value >>> 24) & 0xff
  }

  bytes(value: Uint8Array): void {
    this.#ensure(value.length)
    this.#buf.set(value, this.#len)
    this.#len += value.length
  }

  escU8(value: number): void {
    this.#ensure(2)
    const byte = value & 0xff
    if (byte >= ESCAPE) this.#buf[this.#len++] = ESCAPE
    this.#buf[this.#len++] = byte
  }

  escU16(value: number): void {
    this.#ensure(4)
    this.#esc(value & 0xff)
    this.#esc((value >> 8) & 0xff)
  }

  escU32(value: number): void {
    this.#ensure(8)
    this.#esc(value & 0xff)
    this.#esc((value >> 8) & 0xff)
    this.#esc((value >> 16) & 0xff)
    this.#esc((value >>> 24) & 0xff)
  }

  escU64(value: number): void {
    const lo = value >>> 0
    const hi = Math.floor(value / 0x100000000) >>> 0
    this.escU32(lo)
    this.escU32(hi)
  }

  escBytes(value: Uint8Array): void {
    this.#ensure(value.length * 2)
    for (let i = 0; i < value.length; i++) this.#esc(value[i]!)
  }

  mark(): number {
    return this.#len
  }

  truncate(mark: number): void {
    if (mark < 0 || mark > this.#len) {
      throw new RangeError(`truncate(${mark}) outside 0..${this.#len}`)
    }
    this.#len = mark
  }

  take(): Uint8Array {
    const out = this.#buf.slice(0, this.#len)
    this.#len = 0
    return out
  }

  /** Writes one escaped byte; capacity must already be ensured. */
  #esc(byte: number): void {
    if (byte >= ESCAPE) this.#buf[this.#len++] = ESCAPE
    this.#buf[this.#len++] = byte
  }
}

/** Creates an `OutputBuffer` (see its type for the contract). */
export function createOutputBuffer(options: OutputBufferOptions = {}): OutputBuffer {
  return new GrowingOutputBuffer(options.initialBytes ?? DEFAULT_INITIAL_BYTES)
}
